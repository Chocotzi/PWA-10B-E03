"use client";

import { useEffect, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import {
  PHOTO_ACCEPT_ATTRIBUTE,
  canUseLiveCamera,
  openCamera,
  photoFromFile,
  photoFromVideo,
  stopCamera,
  type CameraOpenResult,
  type PhotoResult,
  type VideoFrameSource,
} from "../lib/device/camera";
import type { InspectionEvidence } from "../lib/device/evidence";
import { requestApproximateLocation, type LocationResult } from "../lib/device/geolocation";
import { queryPermission, type DevicePermissionName, type PermissionStateValue } from "../lib/device/permissions";

/** Acceso a las APIs del dispositivo. Las pruebas sustituyen cualquiera de estas funciones. */
export type DeviceAdapters = {
  canUseLiveCamera: () => boolean;
  openCamera: () => Promise<CameraOpenResult>;
  photoFromFile: (file: File) => Promise<PhotoResult>;
  photoFromVideo: (video: VideoFrameSource) => Promise<PhotoResult>;
  requestLocation: () => Promise<LocationResult>;
  queryPermission: (name: DevicePermissionName) => Promise<PermissionStateValue>;
};

export const browserDeviceAdapters: DeviceAdapters = {
  canUseLiveCamera: () => canUseLiveCamera(),
  openCamera: () => openCamera(),
  photoFromFile: (file) => photoFromFile(file),
  photoFromVideo: (video) => photoFromVideo(video),
  requestLocation: () => requestApproximateLocation(),
  queryPermission: (name) => queryPermission(name),
};

type EvidenceCaptureProps = {
  value: InspectionEvidence;
  onChange: Dispatch<SetStateAction<InspectionEvidence>>;
  devices?: Partial<DeviceAdapters>;
};

function formatKb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Evidencia opcional dentro del formulario de captura. Ningún permiso se solicita al montar:
 * cada API del dispositivo se invoca solo desde el clic de su botón (docs/capabilities.md §2).
 */
export function EvidenceCapture({ value, onChange, devices }: EvidenceCaptureProps) {
  const adaptersRef = useRef<DeviceAdapters>(browserDeviceAdapters);
  adaptersRef.current = { ...browserDeviceAdapters, ...devices };

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [liveCamera, setLiveCamera] = useState(false);
  const [blocked, setBlocked] = useState({ camera: false, geolocation: false });
  const [photoStatus, setPhotoStatus] = useState("");
  const [locationStatus, setLocationStatus] = useState("");
  // Estados independientes: esperar el permiso de cámara no bloquea «Elegir imagen» ni la ubicación.
  const [cameraPending, setCameraPending] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const mountedRef = useRef(false);

  function closeCamera(message?: string) {
    stopCamera(streamRef.current);
    streamRef.current = null;
    setCameraOn(false);
    if (message) setPhotoStatus(message);
  }

  // Detección en el cliente (evita diferencias de hidratación). Consulta estados, no pide permisos.
  useEffect(() => {
    let alive = true;
    const adapters = adaptersRef.current;
    setLiveCamera(adapters.canUseLiveCamera());
    void Promise.all([adapters.queryPermission("camera"), adapters.queryPermission("geolocation")]).then(
      ([camera, geolocation]) => {
        // Se combina con lo que ya se supo por un clic: la consulta nunca borra un rechazo observado.
        if (alive) {
          setBlocked((previous) => ({
            camera: previous.camera || camera === "denied",
            geolocation: previous.geolocation || geolocation === "denied",
          }));
        }
      },
      () => undefined,
    );
    return () => { alive = false; };
  }, []);

  // Conecta el stream al visor cuando aparece.
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!cameraOn || !video || !stream) return;
    video.srcObject = stream;
    const playing = typeof video.play === "function" ? video.play() : undefined;
    if (playing && typeof playing.catch === "function") playing.catch(() => undefined);
  }, [cameraOn]);

  // Privacidad: la cámara se apaga al ocultar la pestaña y al desmontar el formulario.
  useEffect(() => {
    mountedRef.current = true;
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && streamRef.current) closeCamera("Cámara cerrada al ocultar la página.");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      stopCamera(streamRef.current);
      streamRef.current = null;
    };
  }, []);

  function applyPhoto(result: PhotoResult) {
    if (!mountedRef.current) return; // el formulario ya se guardó o se cerró: no se adjunta a otra inspección
    if (result.status === "ok") {
      const photo = result.photo;
      onChange((previous) => ({ ...previous, photo }));
      setPhotoStatus(`Foto adjunta: ${photo.width} × ${photo.height} px, ${formatKb(photo.bytes)}, sin metadatos.`);
    } else {
      setPhotoStatus(result.message);
    }
  }

  async function startCamera() {
    setCameraPending(true);
    setPhotoStatus("Esperando permiso de la cámara… Mientras tanto puedes usar «Elegir imagen».");
    const result = await adaptersRef.current.openCamera();
    if (!mountedRef.current) {
      // El permiso llegó cuando el formulario ya no existe: no se deja la cámara encendida.
      if (result.status === "ready") stopCamera(result.stream);
      return;
    }
    setCameraPending(false);
    if (result.status === "ready") {
      stopCamera(streamRef.current);
      streamRef.current = result.stream;
      setCameraOn(true);
      setBlocked((previous) => ({ ...previous, camera: false }));
      setPhotoStatus("Cámara activa. Encuadra el equipo y pulsa «Capturar foto».");
      return;
    }
    if (result.status === "denied") setBlocked((previous) => ({ ...previous, camera: true }));
    setPhotoStatus(result.message);
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;
    setPhotoBusy(true);
    const result = await adaptersRef.current.photoFromVideo(video);
    closeCamera(); // se apaga en cuanto hay foto o falla la captura
    setPhotoBusy(false);
    applyPhoto(result);
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = ""; // permite volver a elegir el mismo archivo
    if (!file) return;
    setPhotoBusy(true);
    setPhotoStatus("Procesando imagen…");
    const result = await adaptersRef.current.photoFromFile(file);
    setPhotoBusy(false);
    applyPhoto(result);
  }

  function removePhoto() {
    onChange(({ photo: _removed, ...rest }) => rest);
    setPhotoStatus("Foto quitada.");
  }

  async function addLocation() {
    setLocationBusy(true);
    setLocationStatus("Solicitando ubicación aproximada…");
    const result = await adaptersRef.current.requestLocation();
    if (!mountedRef.current) return; // el formulario ya se guardó o se cerró: no se adjunta a otra inspección
    setLocationBusy(false);
    if (result.status === "ok") {
      const location = result.location;
      onChange((previous) => ({ ...previous, location }));
      setBlocked((previous) => ({ ...previous, geolocation: false }));
      setLocationStatus(`Ubicación aproximada agregada (±${location.accuracyMeters} m).`);
      return;
    }
    if (result.status === "denied") setBlocked((previous) => ({ ...previous, geolocation: true }));
    setLocationStatus(result.message);
  }

  function removeLocation() {
    onChange(({ location: _removed, ...rest }) => rest);
    setLocationStatus("Ubicación quitada.");
  }

  const { photo, location } = value;

  return (
    <fieldset className="evidence-fieldset form-wide" aria-describedby="evidence-help">
      <legend>Evidencia opcional</legend>
      <p id="evidence-help" className="evidence-hint">
        Fotografía solo equipos o instalaciones, nunca personas. La foto se reduce a 1280 px y se guarda sin
        metadatos; la ubicación se redondea a unos 100 m. Puedes guardar la inspección sin evidencia.
      </p>

      <div className="evidence-group" role="group" aria-labelledby="evidence-photo-label">
        <p id="evidence-photo-label" className="evidence-label">Foto del equipo</p>
        <div className="evidence-actions">
          {liveCamera && !cameraOn && (
            <button type="button" className="secondary-button" onClick={() => void startCamera()} disabled={cameraPending || photoBusy}>
              Abrir cámara
            </button>
          )}
          <label className={`secondary-button file-button${photoBusy ? " is-disabled" : ""}`}>
            Elegir imagen
            <input
              className="sr-only"
              type="file"
              accept={PHOTO_ACCEPT_ATTRIBUTE}
              onChange={(event) => void chooseFile(event)}
              disabled={photoBusy}
            />
          </label>
          {photo && (
            <button type="button" className="secondary-button" onClick={removePhoto} disabled={photoBusy}>
              Quitar foto
            </button>
          )}
        </div>
        {blocked.camera && !cameraOn && (
          <p className="evidence-hint">La cámara está bloqueada para este sitio; «Elegir imagen» sigue disponible.</p>
        )}
        {cameraOn && (
          <div className="camera-preview">
            <video ref={videoRef} autoPlay playsInline muted aria-label="Vista previa de la cámara" />
            <div className="evidence-actions">
              <button type="button" className="button" onClick={() => void capturePhoto()} disabled={photoBusy}>
                Capturar foto
              </button>
              <button type="button" className="secondary-button" onClick={() => closeCamera("Cámara cerrada.")}>
                Cerrar cámara
              </button>
            </div>
          </div>
        )}
        {photo && (
          <figure className="evidence-preview">
            <img src={photo.dataUrl} alt="Foto de evidencia adjunta a la inspección" width={photo.width} height={photo.height} />
            <figcaption>
              {photo.width} × {photo.height} px · {formatKb(photo.bytes)} · {photo.source === "camera" ? "cámara" : "archivo"}
            </figcaption>
          </figure>
        )}
        <p className="evidence-status" role="status" data-testid="photo-status">{photoStatus}</p>
      </div>

      <div className="evidence-group" role="group" aria-labelledby="evidence-location-label">
        <p id="evidence-location-label" className="evidence-label">Ubicación aproximada</p>
        <div className="evidence-actions">
          <button type="button" className="secondary-button" onClick={() => void addLocation()} disabled={locationBusy}>
            {location ? "Actualizar ubicación" : "Agregar ubicación aproximada"}
          </button>
          {location && (
            <button type="button" className="secondary-button" onClick={removeLocation} disabled={locationBusy}>
              Quitar ubicación
            </button>
          )}
        </div>
        {blocked.geolocation && !location && (
          <p className="evidence-hint">La ubicación está bloqueada para este sitio; puedes guardar sin ella.</p>
        )}
        {location && (
          <p className="evidence-summary">
            {location.latitude.toFixed(3)}, {location.longitude.toFixed(3)} · ±{location.accuracyMeters} m
          </p>
        )}
        <p className="evidence-status" role="status" data-testid="location-status">{locationStatus}</p>
      </div>
    </fieldset>
  );
}
