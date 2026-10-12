// @vitest-environment jsdom
//
// Semana 6 — capacidades del dispositivo y avisos de cambio.
// Los identificadores CAP-0X enlazan cada prueba con docs/capabilities.md (§7, trazabilidad).
// Todo es determinista: las APIs del navegador se sustituyen por dobles con datos sintéticos.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EvidenceCapture, type DeviceAdapters } from "../src/components/evidence-capture";
import { InspectionCaptureClient } from "../src/components/inspection-capture-client";
import { NotificationPreferences } from "../src/components/notification-preferences";
import {
  CAMERA_CONSTRAINTS,
  PHOTO_JPEG_QUALITY,
  PHOTO_MAX_INPUT_BYTES,
  browserPhotoCodec,
  canUseLiveCamera,
  classifyCameraError,
  dataUrlByteLength,
  fitWithin,
  openCamera,
  photoFromFile,
  photoFromVideo,
  stopCamera,
  validatePhotoFile,
  type CameraOpenResult,
  type EvidencePhoto,
  type PhotoCodec,
  type VideoFrameSource,
} from "../src/lib/device/camera";
import { describeEvidence, normalizeEvidence, type InspectionEvidence } from "../src/lib/device/evidence";
import {
  LOCATION_GUARD_MS,
  LOCATION_MAX_AGE_MS,
  LOCATION_TIMEOUT_MS,
  isGeolocationSupported,
  requestApproximateLocation,
  roundCoordinate,
  type ApproximateLocation,
  type GeolocationLike,
  type PositionErrorLike,
  type PositionLike,
} from "../src/lib/device/geolocation";
import { queryPermission } from "../src/lib/device/permissions";
import {
  getNotificationPermission,
  notifyChange,
  requestNotificationPermission,
  savedNotice,
  showLocalNotification,
  syncNotice,
  type NotificationConstructorLike,
} from "../src/lib/notifications/client";
import { ORIGIN, createServiceWorkerHarness, pushData } from "./helpers/sw-harness";

// ---------------------------------------------------------------------------------------------
// Dobles de prueba con datos sintéticos
// ---------------------------------------------------------------------------------------------

const restoreNavigator: Array<() => void> = [];

/** Define una API en `navigator` (jsdom no trae cámara, geolocalización ni permisos). */
function defineNavigator(property: string, value: unknown) {
  const previous = Object.getOwnPropertyDescriptor(window.navigator, property);
  Object.defineProperty(window.navigator, property, { value, configurable: true, writable: true });
  restoreNavigator.push(() => {
    if (previous) Object.defineProperty(window.navigator, property, previous);
    else delete (window.navigator as unknown as Record<string, unknown>)[property];
  });
}

afterEach(() => {
  cleanup();
  while (restoreNavigator.length > 0) restoreNavigator.pop()?.();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const SYNTHETIC_POSITION: PositionLike = {
  coords: { latitude: 18.123456, longitude: -97.654321, accuracy: 12 },
  timestamp: Date.UTC(2026, 9, 11, 15, 0, 0),
};

const ROUNDED_LOCATION: ApproximateLocation = {
  latitude: 18.123,
  longitude: -97.654,
  accuracyMeters: 100,
  capturedAt: "2026-10-11T15:00:00.000Z",
};

type Behavior = (success: (position: PositionLike) => void, error: (error: PositionErrorLike) => void) => void;

function fakeGeolocation(behavior: Behavior) {
  const getCurrentPosition = vi.fn((success: (position: PositionLike) => void, error?: (error: PositionErrorLike) => void, _options?: PositionOptions) => {
    behavior(success, error ?? (() => undefined));
  });
  const watchPosition = vi.fn();
  return { geolocation: { getCurrentPosition, watchPosition } as GeolocationLike & { watchPosition: typeof watchPosition }, getCurrentPosition, watchPosition };
}

function fakeStream(trackCount = 2) {
  const tracks = Array.from({ length: trackCount }, () => ({ stop: vi.fn() }));
  return { stream: { getTracks: () => tracks } as unknown as MediaStream, tracks };
}

function syntheticFile(type = "image/jpeg", size = 4096, name = "IMG_20261011_laboratorio_sintetico.jpg") {
  return new File([new Uint8Array(size)], name, { type });
}

/** Data URL JPEG que representa exactamente `bytes` bytes. */
function jpegDataUrl(bytes: number) {
  return `data:image/jpeg;base64,${Buffer.alloc(bytes).toString("base64")}`;
}

function fakeCodec(options: { width?: number; height?: number; bytes?: number; decodeError?: Error; encodeError?: Error; encoded?: string } = {}) {
  const release = vi.fn();
  const decode = vi.fn(async (_file: Blob) => {
    if (options.decodeError) throw options.decodeError;
    return { source: {} as CanvasImageSource, width: options.width ?? 4000, height: options.height ?? 3000, release };
  });
  const encodeJpeg = vi.fn(async (_image: unknown, _width: number, _height: number, _quality: number) => {
    if (options.encodeError) throw options.encodeError;
    return options.encoded ?? jpegDataUrl(options.bytes ?? 150_000);
  });
  const codec: PhotoCodec = { decode, encodeJpeg };
  return { codec, decode, encodeJpeg, release };
}

const FIXED_NOW = () => new Date("2026-10-11T16:30:00.000Z");

function syntheticPhoto(source: EvidencePhoto["source"] = "file"): EvidencePhoto {
  return { mimeType: "image/jpeg", dataUrl: jpegDataUrl(120_000), width: 1280, height: 960, bytes: 120_000, source, capturedAt: "2026-10-11T16:30:00.000Z" };
}

function fakeNotificationApi(permission: NotificationPermission, options: { throwOnConstruct?: boolean; result?: NotificationPermission } = {}) {
  const constructed: Array<[string, NotificationOptions | undefined]> = [];
  const state = { permission };
  const requestPermission = vi.fn(async () => {
    state.permission = options.result ?? "granted";
    return state.permission;
  });
  const NotificationApi = function (this: unknown, title: string, init?: NotificationOptions) {
    if (options.throwOnConstruct) throw new TypeError("Failed to construct 'Notification': Illegal constructor.");
    constructed.push([title, init]);
  } as unknown as NotificationConstructorLike;
  Object.defineProperty(NotificationApi, "permission", { get: () => state.permission });
  Object.defineProperty(NotificationApi, "requestPermission", { value: requestPermission });
  return { NotificationApi, constructed, requestPermission, state };
}

function stubSyncServer() {
  const bodies: Array<Record<string, any>> = [];
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, any>;
    bodies.push(body);
    return new Response(JSON.stringify({ kind: "applied", revision: `rev-${body.id}` }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, bodies };
}

function unavailableDevices(): Partial<DeviceAdapters> {
  return {
    canUseLiveCamera: () => false,
    openCamera: vi.fn(async () => ({ status: "unsupported" as const, message: "sin cámara" })),
    requestLocation: vi.fn(async () => ({ status: "unsupported" as const, message: "Este navegador no ofrece geolocalización. Puedes guardar la inspección sin ubicación." })),
    queryPermission: vi.fn(async () => "unknown" as const),
  };
}

// ---------------------------------------------------------------------------------------------
// CAP-02 · Ubicación aproximada opcional
// ---------------------------------------------------------------------------------------------

describe("CAP-02 ubicación aproximada con permisos mínimos y fallback", () => {
  it("no inventa coordenadas cuando la API no existe", async () => {
    const result = await requestApproximateLocation({});
    expect(result.status).toBe("unsupported");
    expect(result).not.toHaveProperty("location");
    expect(result.status !== "ok" && result.message).toContain("sin ubicación");
  });

  it("en un contexto inseguro no toca la API", async () => {
    const fake = fakeGeolocation((success) => success(SYNTHETIC_POSITION));
    const result = await requestApproximateLocation({ geolocation: fake.geolocation, isSecureContext: false });
    expect(result.status).toBe("insecure-context");
    expect(fake.getCurrentPosition).not.toHaveBeenCalled();
  });

  it("pide una sola lectura sin alta precisión y nunca usa watchPosition", async () => {
    const fake = fakeGeolocation((success) => success(SYNTHETIC_POSITION));
    await requestApproximateLocation({ geolocation: fake.geolocation, isSecureContext: true });
    expect(fake.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(fake.getCurrentPosition.mock.calls[0][2]).toEqual({
      enableHighAccuracy: false,
      timeout: LOCATION_TIMEOUT_MS,
      maximumAge: LOCATION_MAX_AGE_MS,
    });
    expect(fake.watchPosition).not.toHaveBeenCalled();
  });

  it("redondea a 3 decimales (≈ 110 m) y nunca declara una precisión menor a 100 m", async () => {
    const fake = fakeGeolocation((success) => success(SYNTHETIC_POSITION));
    const result = await requestApproximateLocation({ geolocation: fake.geolocation, isSecureContext: true });
    expect(result).toEqual({ status: "ok", location: ROUNDED_LOCATION });
  });

  it("conserva la precisión reportada cuando ya es peor que 100 m", async () => {
    const fake = fakeGeolocation((success) => success({ coords: { latitude: 10.5, longitude: -20.25, accuracy: 350.4 } }));
    const result = await requestApproximateLocation({ geolocation: fake.geolocation, now: FIXED_NOW });
    expect(result).toEqual({
      status: "ok",
      location: { latitude: 10.5, longitude: -20.25, accuracyMeters: 350, capturedAt: "2026-10-11T16:30:00.000Z" },
    });
  });

  it.each([
    [1, "denied"],
    [2, "unavailable"],
    [3, "timeout"],
    [99, "error"],
  ])("traduce el código de error %i a «%s» y explica cómo continuar", async (code, status) => {
    const fake = fakeGeolocation((_success, error) => error({ code, message: "sintético" }));
    const result = await requestApproximateLocation({ geolocation: fake.geolocation });
    expect(result.status).toBe(status);
    expect(result.status !== "ok" && result.message).toMatch(/sin ubicación/);
  });

  it("resuelve «timeout» si el navegador nunca responde (diálogo de permiso ignorado)", async () => {
    vi.useFakeTimers();
    const fake = fakeGeolocation(() => undefined);
    const pending = requestApproximateLocation({ geolocation: fake.geolocation });
    await vi.advanceTimersByTimeAsync(LOCATION_GUARD_MS);
    await expect(pending).resolves.toMatchObject({ status: "timeout" });
  });

  it("entrega un solo resultado: una respuesta tardía no lo cambia y el temporizador se limpia", async () => {
    let success: ((position: PositionLike) => void) | undefined;
    let fireGuard: (() => void) | undefined;
    const clearTimer = vi.fn();
    const fake = fakeGeolocation((onSuccess) => { success = onSuccess; });
    const pending = requestApproximateLocation({
      geolocation: fake.geolocation,
      setTimer: (callback) => { fireGuard = callback; return "guard"; },
      clearTimer,
    });
    fireGuard?.();
    success?.(SYNTHETIC_POSITION);
    await expect(pending).resolves.toMatchObject({ status: "timeout" });
    expect(clearTimer).toHaveBeenCalledWith("guard");
  });

  it("convierte un error síncrono de la API en un estado, sin lanzar", async () => {
    const geolocation: GeolocationLike = { getCurrentPosition: () => { throw new Error("bloqueada por política"); } };
    await expect(requestApproximateLocation({ geolocation })).resolves.toMatchObject({ status: "error" });
  });

  it("descarta coordenadas imposibles en lugar de guardarlas", async () => {
    for (const coords of [
      { latitude: Number.NaN, longitude: 1, accuracy: 5 },
      { latitude: 95, longitude: 1, accuracy: 5 },
      { latitude: 1, longitude: -181, accuracy: 5 },
    ]) {
      const fake = fakeGeolocation((success) => success({ coords }));
      await expect(requestApproximateLocation({ geolocation: fake.geolocation })).resolves.toMatchObject({ status: "unavailable" });
    }
  });

  it("redondea sin producir -0 y detecta el soporte", () => {
    expect(Object.is(roundCoordinate(-0.0004), 0)).toBe(true);
    expect(roundCoordinate(18.12351)).toBe(18.124);
    expect(isGeolocationSupported({})).toBe(false);
    expect(isGeolocationSupported({ geolocation: fakeGeolocation(() => undefined).geolocation, isSecureContext: false })).toBe(false);
    expect(isGeolocationSupported({ geolocation: fakeGeolocation(() => undefined).geolocation, isSecureContext: true })).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// CAP-01 · Foto de evidencia opcional
// ---------------------------------------------------------------------------------------------

describe("CAP-01 cámara en vivo con permisos mínimos", () => {
  it("solo ofrece la cámara en vivo con la API presente y en contexto seguro", () => {
    const getUserMedia = vi.fn();
    expect(canUseLiveCamera({})).toBe(false);
    expect(canUseLiveCamera({ mediaDevices: { getUserMedia }, isSecureContext: false })).toBe(false);
    expect(canUseLiveCamera({ mediaDevices: { getUserMedia }, isSecureContext: true })).toBe(true);
  });

  it("devuelve «unsupported» sin API e «insecure-context» sin llamar a getUserMedia", async () => {
    const getUserMedia = vi.fn();
    await expect(openCamera({})).resolves.toMatchObject({ status: "unsupported" });
    await expect(openCamera({ mediaDevices: { getUserMedia }, isSecureContext: false })).resolves.toMatchObject({ status: "insecure-context" });
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("pide solo video (sin audio), cámara trasera y resolución moderada, conservando `this`", async () => {
    const { stream } = fakeStream();
    const mediaDevices = {
      getUserMedia: vi.fn(async function (this: unknown, _constraints: MediaStreamConstraints) {
        if (this !== mediaDevices) throw new TypeError("Illegal invocation");
        return stream;
      }),
    };
    const result = await openCamera({ mediaDevices, isSecureContext: true });
    expect(result).toEqual({ status: "ready", stream });
    expect(mediaDevices.getUserMedia).toHaveBeenCalledWith(CAMERA_CONSTRAINTS);
    expect(CAMERA_CONSTRAINTS.audio).toBe(false);
    expect(CAMERA_CONSTRAINTS.video).toMatchObject({ facingMode: { ideal: "environment" }, width: { ideal: 1280 } });
  });

  it.each([
    ["NotAllowedError", "denied"],
    ["SecurityError", "denied"],
    ["NotFoundError", "not-found"],
    ["OverconstrainedError", "not-found"],
    ["NotReadableError", "busy"],
    ["TypeError", "error"],
  ])("traduce %s a «%s» y ofrece el selector de archivos como alternativa", async (name, status) => {
    const getUserMedia = vi.fn(async () => { throw Object.assign(new Error("sintético"), { name }); });
    const result = await openCamera({ mediaDevices: { getUserMedia }, isSecureContext: true });
    expect(result.status).toBe(status);
    expect(result.status !== "ready" && result.message).toContain("Elegir imagen");
  });

  it("clasifica valores que no son errores sin lanzar", () => {
    expect(classifyCameraError(undefined)).toBe("error");
    expect(classifyCameraError("NotAllowedError")).toBe("error");
  });

  it("detiene todos los tracks y tolera un stream nulo", () => {
    const { stream, tracks } = fakeStream(3);
    expect(stopCamera(stream)).toBe(3);
    tracks.forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1));
    expect(stopCamera(null)).toBe(0);
  });
});

describe("CAP-01 foto: validación, reducción y limpieza de metadatos", () => {
  it("rechaza archivos vacíos, formatos no admitidos (incluido SVG) y entradas demasiado grandes", () => {
    expect(validatePhotoFile({ type: "image/jpeg", size: 0 })).toBe("empty");
    expect(validatePhotoFile({ type: "image/gif", size: 10 })).toBe("unsupported-type");
    expect(validatePhotoFile({ type: "image/svg+xml", size: 10 })).toBe("unsupported-type");
    expect(validatePhotoFile({ type: "image/jpeg", size: PHOTO_MAX_INPUT_BYTES + 1 })).toBe("too-large");
    expect(validatePhotoFile({ type: "image/webp", size: PHOTO_MAX_INPUT_BYTES })).toBeNull();
  });

  it("no decodifica un archivo inválido", async () => {
    const { codec, decode } = fakeCodec();
    const result = await photoFromFile(syntheticFile("image/gif"), codec);
    expect(result.status).toBe("unsupported-type");
    expect(decode).not.toHaveBeenCalled();
  });

  it("vuelve a codificar como JPEG de máximo 1280 px, sin nombre de archivo y liberando la imagen", async () => {
    const { codec, encodeJpeg, release } = fakeCodec({ width: 4000, height: 3000, bytes: 150_000 });
    const result = await photoFromFile(syntheticFile(), codec, FIXED_NOW);
    expect(result).toEqual({
      status: "ok",
      photo: {
        mimeType: "image/jpeg",
        dataUrl: jpegDataUrl(150_000),
        width: 1280,
        height: 960,
        bytes: 150_000,
        source: "file",
        capturedAt: "2026-10-11T16:30:00.000Z",
      },
    });
    expect(encodeJpeg).toHaveBeenCalledWith(expect.anything(), 1280, 960, PHOTO_JPEG_QUALITY);
    expect(JSON.stringify(result)).not.toContain("IMG_");
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("sin procesador de imágenes no adjunta nada y deja continuar", async () => {
    await expect(photoFromFile(syntheticFile(), null)).resolves.toMatchObject({ status: "processing-unavailable" });
  });

  it("convierte fallos de decodificación o codificación en un estado y libera la imagen", async () => {
    const broken = fakeCodec({ decodeError: new Error("archivo dañado") });
    await expect(photoFromFile(syntheticFile(), broken.codec)).resolves.toMatchObject({ status: "processing-failed" });
    const failing = fakeCodec({ encodeError: new Error("sin memoria") });
    await expect(photoFromFile(syntheticFile(), failing.codec)).resolves.toMatchObject({ status: "processing-failed" });
    expect(failing.release).toHaveBeenCalledTimes(1);
  });

  it("rechaza el resultado si supera 1 MB o si el navegador no produjo JPEG", async () => {
    const heavy = fakeCodec({ bytes: 1024 * 1024 + 1 });
    await expect(photoFromFile(syntheticFile(), heavy.codec)).resolves.toMatchObject({ status: "too-large" });
    const png = fakeCodec({ encoded: "data:image/png;base64,AAAA" });
    await expect(photoFromFile(syntheticFile(), png.codec)).resolves.toMatchObject({ status: "processing-failed" });
  });

  it("captura un cuadro de la cámara solo cuando el video ya tiene imagen", async () => {
    const { codec, encodeJpeg } = fakeCodec();
    const empty = { videoWidth: 0, videoHeight: 0 } as VideoFrameSource;
    await expect(photoFromVideo(empty, codec)).resolves.toMatchObject({ status: "processing-failed" });
    expect(encodeJpeg).not.toHaveBeenCalled();

    const frame = { videoWidth: 1920, videoHeight: 1080 } as VideoFrameSource;
    const result = await photoFromVideo(frame, codec, FIXED_NOW);
    expect(result).toMatchObject({ status: "ok", photo: { width: 1280, height: 720, source: "camera" } });
    await expect(photoFromVideo(frame, null)).resolves.toMatchObject({ status: "processing-unavailable" });
    const failing = fakeCodec({ encodeError: new Error("canvas") });
    await expect(photoFromVideo(frame, failing.codec)).resolves.toMatchObject({ status: "processing-failed" });
  });

  it("calcula tamaño y bytes sin agrandar imágenes pequeñas", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 960, height: 1280 });
    expect(fitWithin(0, 10)).toBeNull();
    expect(dataUrlByteLength("data:image/jpeg;base64,AAAA")).toBe(3);
    expect(dataUrlByteLength("data:image/jpeg;base64,AA==")).toBe(1);
    expect(dataUrlByteLength("sin-coma")).toBe(0);
  });

  it("el adaptador del navegador no existe sin createImageBitmap", () => {
    expect(browserPhotoCodec()).toBeNull();
  });

  it("el adaptador del navegador dibuja al tamaño reducido, exporta JPEG y cierra el bitmap", async () => {
    const close = vi.fn();
    const bitmap = { width: 2560, height: 1440, close };
    vi.stubGlobal("createImageBitmap", vi.fn(async () => bitmap));
    const drawImage = vi.fn();
    const fillRect = vi.fn();
    const context2d = { drawImage, fillRect, fillStyle: "" };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context2d as unknown as CanvasRenderingContext2D);
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(jpegDataUrl(2_000));

    const result = await photoFromFile(syntheticFile());
    expect(result).toMatchObject({ status: "ok", photo: { width: 1280, height: 720, bytes: 2_000 } });
    expect(fillRect).toHaveBeenCalledWith(0, 0, 1280, 720);
    expect(context2d.fillStyle).toBe("#ffffff");
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1280, 720);
    expect(toDataURL).toHaveBeenCalledWith("image/jpeg", PHOTO_JPEG_QUALITY);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("si el canvas no está disponible, informa el fallo y también cierra el bitmap", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 100, height: 100, close })));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    await expect(photoFromFile(syntheticFile())).resolves.toMatchObject({ status: "processing-failed" });
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe("CAP-05 consulta de permisos sin solicitarlos", () => {
  it("devuelve el estado, o «unknown» si la API falta o no reconoce el nombre", async () => {
    await expect(queryPermission("geolocation", { query: async () => ({ state: "denied" }) })).resolves.toBe("denied");
    await expect(queryPermission("camera", { query: async () => ({ state: "otro" }) })).resolves.toBe("unknown");
    await expect(queryPermission("camera", { query: async () => { throw new TypeError("camera no soportado"); } })).resolves.toBe("unknown");
    await expect(queryPermission("notifications", undefined)).resolves.toBe("unknown");
  });

  it("la evidencia vacía no se guarda y se describe para la lista de pendientes", () => {
    const location = ROUNDED_LOCATION;
    expect(normalizeEvidence(undefined)).toBeUndefined();
    expect(normalizeEvidence({})).toBeUndefined();
    expect(normalizeEvidence({ location })).toEqual({ location });
    expect(describeEvidence(undefined)).toBe("sin evidencia");
    expect(describeEvidence({ photo: syntheticPhoto(), location })).toBe("con foto y con ubicación aproximada");
  });
});

// ---------------------------------------------------------------------------------------------
// CAP-03 · Avisos de cambio con fallback
// ---------------------------------------------------------------------------------------------

describe("CAP-03 avisos de cambio: permiso y canal", () => {
  it("sin API devuelve «unsupported» sin lanzar", async () => {
    expect(getNotificationPermission({})).toBe("unsupported");
    await expect(requestNotificationPermission({})).resolves.toBe("unsupported");
    await expect(notifyChange(savedNotice({ id: "x", location: "Laboratorio de Redes" }, true), {})).resolves.toEqual({ channel: "in-app", reason: "unsupported" });
  });

  it("no vuelve a preguntar si la persona ya decidió", async () => {
    for (const permission of ["granted", "denied"] as const) {
      const api = fakeNotificationApi(permission);
      await expect(requestNotificationPermission({ Notification: api.NotificationApi })).resolves.toBe(permission);
      expect(api.requestPermission).not.toHaveBeenCalled();
    }
  });

  it("pregunta una sola vez cuando aún no hay decisión", async () => {
    const api = fakeNotificationApi("default", { result: "denied" });
    await expect(requestNotificationPermission({ Notification: api.NotificationApi })).resolves.toBe("denied");
    expect(api.requestPermission).toHaveBeenCalledTimes(1);
  });

  it("acepta la API antigua de Safari basada en callback", async () => {
    const NotificationApi = { permission: "default", requestPermission: (callback?: (value: NotificationPermission) => void) => { callback?.("granted"); } } as unknown as NotificationConstructorLike;
    await expect(requestNotificationPermission({ Notification: NotificationApi })).resolves.toBe("granted");
  });

  it("si requestPermission falla devuelve el estado actual", async () => {
    const NotificationApi = { permission: "default", requestPermission: () => Promise.reject(new Error("bloqueado")) } as unknown as NotificationConstructorLike;
    await expect(requestNotificationPermission({ Notification: NotificationApi })).resolves.toBe("default");
  });

  it("sin permiso concedido usa solo el aviso en la página y no crea notificaciones", async () => {
    const pending = fakeNotificationApi("default");
    const blocked = fakeNotificationApi("denied");
    const notice = savedNotice({ id: "synthetic-1", location: "Laboratorio de Redes" }, true);
    await expect(notifyChange(notice, { Notification: pending.NotificationApi })).resolves.toEqual({ channel: "in-app", reason: "permission-default" });
    await expect(notifyChange(notice, { Notification: blocked.NotificationApi })).resolves.toEqual({ channel: "in-app", reason: "permission-denied" });
    expect(pending.constructed).toHaveLength(0);
    expect(blocked.constructed).toHaveLength(0);
  });

  it("con permiso prefiere el service worker (requisito de Chrome Android)", async () => {
    const api = fakeNotificationApi("granted");
    const showNotification = vi.fn(async () => undefined);
    const result = await notifyChange(
      { title: "Inspección guardada", body: "Laboratorio de Redes: guardada.", tag: "inspeccion-synthetic-1" },
      { Notification: api.NotificationApi, getRegistration: async () => ({ showNotification }) },
    );
    expect(result).toEqual({ channel: "system", via: "service-worker" });
    expect(showNotification).toHaveBeenCalledWith("Inspección guardada", {
      body: "Laboratorio de Redes: guardada.",
      tag: "inspeccion-synthetic-1",
      icon: "/icons/icon-192x192.png",
      data: { url: "/inspecciones" },
    });
    expect(api.constructed).toHaveLength(0);
  });

  it("sin service worker usa el constructor de página; si el worker falla, también", async () => {
    const api = fakeNotificationApi("granted");
    const notice = syncNotice({ sent: 2, conflicts: 0 });
    expect(notice).not.toBeNull();
    await expect(notifyChange(notice!, { Notification: api.NotificationApi, getRegistration: async () => undefined })).resolves.toEqual({ channel: "system", via: "page" });
    await expect(notifyChange(notice!, { Notification: api.NotificationApi, getRegistration: () => Promise.reject(new Error("sin worker")) })).resolves.toEqual({ channel: "system", via: "page" });
    expect(api.constructed.map(([title]) => title)).toEqual(["Sincronización completada", "Sincronización completada"]);
  });

  it("si el navegador prohíbe el constructor (Android sin worker) vuelve al aviso en la página", async () => {
    const api = fakeNotificationApi("granted", { throwOnConstruct: true });
    await expect(notifyChange(savedNotice({ id: "a", location: "Laboratorio de Software" }, false), { Notification: api.NotificationApi }))
      .resolves.toEqual({ channel: "in-app", reason: "failed" });
  });

  it("limita la longitud de título y cuerpo", async () => {
    const api = fakeNotificationApi("granted");
    await notifyChange({ title: "T".repeat(200), body: "B".repeat(500), tag: "largo" }, { Notification: api.NotificationApi });
    const [title, options] = api.constructed[0];
    expect(title.length).toBeLessThanOrEqual(60);
    expect(String(options?.body).length).toBeLessThanOrEqual(140);
  });

  it("el texto del aviso solo revela laboratorio y estado, nunca responsable ni resumen", () => {
    const inspection = { id: "synthetic-9", location: "Laboratorio de Electrónica", inspector: "Técnica de prueba", summary: "Resumen sintético privado" };
    const online = savedNotice(inspection, true);
    const offline = savedNotice(inspection, false);
    for (const notice of [online, offline]) {
      expect(JSON.stringify(notice)).not.toContain("Técnica de prueba");
      expect(JSON.stringify(notice)).not.toContain("Resumen sintético privado");
      expect(notice.body).toContain("Laboratorio de Electrónica");
      expect(notice.tag).toBe("inspeccion-synthetic-9");
    }
    expect(offline.body).toContain("sin conexión");
  });

  it("solo hay aviso de sincronización cuando algo cambió", () => {
    expect(syncNotice({ sent: 0, conflicts: 0 })).toBeNull();
    expect(syncNotice({ sent: 1, conflicts: 0 })?.body).toBe("1 inspección enviada al servidor.");
    expect(syncNotice({ sent: 3, conflicts: 0 })?.body).toBe("3 inspecciones enviadas al servidor.");
    expect(syncNotice({ sent: 1, conflicts: 1 })).toMatchObject({ title: "Conflicto de sincronización", tag: "sincronizacion-conflicto" });
    expect(syncNotice({ sent: 0, conflicts: 2 })?.body).toContain("2 inspecciones requieren revisión");
  });

  it("showLocalNotification conserva su contrato y no lanza", () => {
    expect(showLocalNotification("x", undefined, { Notification: fakeNotificationApi("default").NotificationApi })).toBeNull();
    expect(showLocalNotification("x", undefined, { Notification: fakeNotificationApi("granted", { throwOnConstruct: true }).NotificationApi })).toBeNull();
    expect(showLocalNotification("x", undefined, {})).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// CAP-04 · Service worker: push entrante y clic en avisos
// ---------------------------------------------------------------------------------------------

describe("CAP-04 service worker: push y clic en avisos", () => {
  const network = () => vi.fn(async () => new Response("ok"));

  it("muestra un push JSON con texto acotado y una ruta del mismo origen", async () => {
    const harness = createServiceWorkerHarness(network());
    await harness.push(pushData(JSON.stringify({ title: "Revisión pendiente", body: "Laboratorio de Redes requiere atención.", tag: "lab-redes", url: "/inspecciones/inspection-002" })));
    expect(harness.showNotification).toHaveBeenCalledWith("Revisión pendiente", {
      body: "Laboratorio de Redes requiere atención.",
      tag: "lab-redes",
      icon: "/icons/icon-192x192.png",
      data: { url: "/inspecciones/inspection-002" },
    });
  });

  it("acepta el texto plano que envía DevTools y usa valores por defecto sin datos", async () => {
    const harness = createServiceWorkerHarness(network());
    await harness.push(pushData("Test push message from DevTools."));
    expect(harness.showNotification).toHaveBeenLastCalledWith("Inspecciones de laboratorio", expect.objectContaining({ body: "Test push message from DevTools.", data: { url: "/inspecciones" } }));
    await harness.push(null);
    expect(harness.showNotification).toHaveBeenLastCalledWith("Inspecciones de laboratorio", expect.objectContaining({ body: "Hay cambios en las inspecciones.", tag: "inspecciones-push" }));
  });

  it("no permite que un push abra otro sitio y recorta títulos largos", async () => {
    const harness = createServiceWorkerHarness(network());
    await harness.push(pushData(JSON.stringify({ title: "X".repeat(300), url: "https://sitio-externo.example/phishing" })));
    const [title, options] = harness.showNotification.mock.calls[0];
    expect(title.length).toBeLessThanOrEqual(80);
    expect(options).toMatchObject({ data: { url: "/inspecciones" } });
  });

  it("al pulsar un aviso enfoca la pestaña abierta en esa ruta", async () => {
    const harness = createServiceWorkerHarness(network());
    const focus = vi.fn(async () => undefined);
    harness.windowClients.push({ url: `${ORIGIN}/inspecciones`, focus });
    const close = vi.fn();
    await harness.notificationClick({ data: { url: "/inspecciones" }, close });
    expect(close).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(harness.openWindow).not.toHaveBeenCalled();
  });

  it("si no hay pestaña abierta abre la ruta del mismo origen; nunca una externa", async () => {
    const harness = createServiceWorkerHarness(network());
    harness.windowClients.push({ url: `${ORIGIN}/`, focus: vi.fn(async () => undefined) });
    await harness.notificationClick({ data: { url: "/inspecciones/inspection-001" }, close: vi.fn() });
    expect(harness.openWindow).toHaveBeenLastCalledWith(`${ORIGIN}/inspecciones/inspection-001`);
    await harness.notificationClick({ data: { url: "https://sitio-externo.example/" }, close: vi.fn() });
    expect(harness.openWindow).toHaveBeenLastCalledWith(`${ORIGIN}/inspecciones`);
  });
});

// ---------------------------------------------------------------------------------------------
// Adaptadores reales del navegador: mismas funciones, leyendo `navigator` y `window`
// ---------------------------------------------------------------------------------------------

describe("adaptadores del navegador (cableado con `navigator`)", () => {
  it("la ubicación usa navigator.geolocation y la hora local si la posición no trae timestamp", async () => {
    const fake = fakeGeolocation((success) => success({ coords: { latitude: 18.4444, longitude: -97.3333, accuracy: 30 } }));
    defineNavigator("geolocation", fake.geolocation);
    expect(isGeolocationSupported()).toBe(true);
    const result = await requestApproximateLocation();
    expect(result).toMatchObject({ status: "ok", location: { latitude: 18.444, longitude: -97.333, accuracyMeters: 100 } });
    expect(result.status === "ok" && Number.isNaN(Date.parse(result.location.capturedAt))).toBe(false);
  });

  it("la cámara usa navigator.mediaDevices y los permisos navigator.permissions", async () => {
    const { stream } = fakeStream(1);
    const getUserMedia = vi.fn(async () => stream);
    defineNavigator("mediaDevices", { getUserMedia });
    defineNavigator("permissions", { query: async ({ name }: { name: string }) => ({ state: name === "camera" ? "denied" : "prompt" }) });
    await expect(openCamera()).resolves.toEqual({ status: "ready", stream });
    await expect(queryPermission("camera")).resolves.toBe("denied");
    await expect(queryPermission("geolocation")).resolves.toBe("prompt");
  });

  it("la foto de la cámara toma la hora actual si no se inyecta reloj", async () => {
    const { codec } = fakeCodec();
    const result = await photoFromVideo({ videoWidth: 640, videoHeight: 480 } as VideoFrameSource, codec);
    expect(result).toMatchObject({ status: "ok", photo: { width: 640, height: 480 } });
    expect(result.status === "ok" && Number.isNaN(Date.parse(result.photo.capturedAt))).toBe(false);
  });

  it("los avisos usan window.Notification y el registro del service worker", async () => {
    const api = fakeNotificationApi("granted");
    vi.stubGlobal("Notification", api.NotificationApi);
    const showNotification = vi.fn(async () => undefined);
    defineNavigator("serviceWorker", { getRegistration: vi.fn(async () => ({ showNotification })) });
    expect(getNotificationPermission()).toBe("granted");
    await expect(notifyChange(syncNotice({ sent: 1, conflicts: 0 })!)).resolves.toEqual({ channel: "system", via: "service-worker" });
    expect(showNotification).toHaveBeenCalledWith("Sincronización completada", expect.objectContaining({ tag: "sincronizacion-resultado" }));
    expect(api.constructed).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------
// CAP-05 · Interfaz: permisos solo bajo acción de la persona
// ---------------------------------------------------------------------------------------------

function renderEvidence(devices: Partial<DeviceAdapters>, initial: InspectionEvidence = {}) {
  let current = initial;
  const onChange = vi.fn((update: InspectionEvidence | ((previous: InspectionEvidence) => InspectionEvidence)) => {
    current = typeof update === "function" ? update(current) : update;
    view.rerender(createElement(EvidenceCapture, { value: current, onChange, devices }));
  });
  const view = render(createElement(EvidenceCapture, { value: current, onChange, devices }));
  return { view, onChange, evidence: () => current };
}

describe("CAP-05 interfaz: permisos solo bajo acción de la persona", () => {
  it("al cargar la captura no solicita cámara, ubicación ni notificaciones", async () => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    stubSyncServer();
    const getUserMedia = vi.fn();
    const getCurrentPosition = vi.fn();
    const watchPosition = vi.fn();
    defineNavigator("mediaDevices", { getUserMedia });
    defineNavigator("geolocation", { getCurrentPosition, watchPosition });
    const api = fakeNotificationApi("default");
    vi.stubGlobal("Notification", api.NotificationApi);

    render(createElement(InspectionCaptureClient));
    await screen.findByText("Sincronización terminada.");

    expect(getUserMedia).not.toHaveBeenCalled();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(watchPosition).not.toHaveBeenCalled();
    expect(api.requestPermission).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Agregar ubicación aproximada" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Activar avisos" })).toBeTruthy();
  });

  it("la ubicación se pide una vez al pulsar el botón y se puede quitar", async () => {
    const requestLocation = vi.fn(async () => ({ status: "ok" as const, location: ROUNDED_LOCATION }));
    const { evidence } = renderEvidence({ ...unavailableDevices(), requestLocation });
    expect(requestLocation).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Agregar ubicación aproximada" }));
    expect(await screen.findByText("Ubicación aproximada agregada (±100 m).")).toBeTruthy();
    expect(requestLocation).toHaveBeenCalledTimes(1);
    expect(screen.getByText("18.123, -97.654 · ±100 m")).toBeTruthy();
    expect(evidence()).toEqual({ location: ROUNDED_LOCATION });

    fireEvent.click(screen.getByRole("button", { name: "Quitar ubicación" }));
    expect(evidence()).toEqual({});
  });

  it("si se niega la ubicación explica cómo continuar y no adjunta nada", async () => {
    const requestLocation = vi.fn(async () => ({ status: "denied" as const, message: "Permiso de ubicación denegado. Puedes guardar la inspección sin ubicación." }));
    const { evidence } = renderEvidence({ ...unavailableDevices(), requestLocation });
    fireEvent.click(screen.getByRole("button", { name: "Agregar ubicación aproximada" }));
    expect(await screen.findByText("Permiso de ubicación denegado. Puedes guardar la inspección sin ubicación.")).toBeTruthy();
    expect(screen.getByText("La ubicación está bloqueada para este sitio; puedes guardar sin ella.")).toBeTruthy();
    expect(evidence()).toEqual({});
  });

  it("sin cámara en vivo solo ofrece «Elegir imagen» y valida el formato con el adaptador real", async () => {
    renderEvidence({ ...unavailableDevices(), photoFromFile: (file) => photoFromFile(file) });
    expect(screen.queryByRole("button", { name: "Abrir cámara" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Elegir imagen"), { target: { files: [syntheticFile("image/gif")] } });
    expect(await screen.findByText("Formato no admitido. Usa una imagen JPG, PNG o WebP.")).toBeTruthy();
  });

  it("cámara en vivo: se abre al pulsar, captura y apaga los tracks de inmediato", async () => {
    const { stream, tracks } = fakeStream(2);
    const openCameraMock = vi.fn(async () => ({ status: "ready" as const, stream }));
    const photoFromVideoMock = vi.fn(async () => ({ status: "ok" as const, photo: syntheticPhoto("camera") }));
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const { evidence } = renderEvidence({ ...unavailableDevices(), canUseLiveCamera: () => true, openCamera: openCameraMock, photoFromVideo: photoFromVideoMock });

    fireEvent.click(await screen.findByRole("button", { name: "Abrir cámara" }));
    expect(await screen.findByLabelText("Vista previa de la cámara")).toBeTruthy();
    expect(openCameraMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Capturar foto" }));
    expect(await screen.findByText(/Foto adjunta: 1280 × 960 px, 117 KB, sin metadatos\./)).toBeTruthy();
    tracks.forEach((track) => expect(track.stop).toHaveBeenCalled());
    expect(screen.queryByLabelText("Vista previa de la cámara")).toBeNull();
    expect(screen.getByAltText("Foto de evidencia adjunta a la inspección")).toBeTruthy();
    expect(evidence().photo?.source).toBe("camera");

    fireEvent.click(screen.getByRole("button", { name: "Quitar foto" }));
    expect(evidence()).toEqual({});
  });

  it("si se niega la cámara deja disponible el selector de archivos", async () => {
    const openCameraMock = vi.fn(async () => ({ status: "denied" as const, message: "Permiso de cámara denegado. Puedes usar «Elegir imagen» o guardar sin foto." }));
    renderEvidence({ ...unavailableDevices(), canUseLiveCamera: () => true, openCamera: openCameraMock });
    fireEvent.click(await screen.findByRole("button", { name: "Abrir cámara" }));
    expect(await screen.findByText("Permiso de cámara denegado. Puedes usar «Elegir imagen» o guardar sin foto.")).toBeTruthy();
    expect(screen.getByText("La cámara está bloqueada para este sitio; «Elegir imagen» sigue disponible.")).toBeTruthy();
    expect(screen.getByLabelText("Elegir imagen")).toBeTruthy();
  });

  it("esperar el permiso de cámara no bloquea «Elegir imagen» ni la ubicación", async () => {
    let answer: ((value: CameraOpenResult) => void) | undefined;
    const openCameraMock = vi.fn(() => new Promise<CameraOpenResult>((resolve) => { answer = resolve; }));
    const requestLocation = vi.fn(async () => ({ status: "ok" as const, location: ROUNDED_LOCATION }));
    renderEvidence({ ...unavailableDevices(), canUseLiveCamera: () => true, openCamera: openCameraMock, requestLocation });

    fireEvent.click(await screen.findByRole("button", { name: "Abrir cámara" }));
    expect(await screen.findByText(/Esperando permiso de la cámara/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Abrir cámara" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Elegir imagen") as HTMLInputElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Agregar ubicación aproximada" }));
    expect(await screen.findByText("Ubicación aproximada agregada (±100 m).")).toBeTruthy();

    answer?.({ status: "denied", message: "Permiso de cámara denegado. Puedes usar «Elegir imagen» o guardar sin foto." });
    expect(await screen.findByText("Permiso de cámara denegado. Puedes usar «Elegir imagen» o guardar sin foto.")).toBeTruthy();
  });

  it("si el formulario se desmonta antes de que llegue el permiso, la cámara se apaga al llegar", async () => {
    let answer: ((value: CameraOpenResult) => void) | undefined;
    const { stream, tracks } = fakeStream(1);
    const openCameraMock = vi.fn(() => new Promise<CameraOpenResult>((resolve) => { answer = resolve; }));
    const { view } = renderEvidence({ ...unavailableDevices(), canUseLiveCamera: () => true, openCamera: openCameraMock });
    fireEvent.click(await screen.findByRole("button", { name: "Abrir cámara" }));
    view.unmount();
    answer?.({ status: "ready", stream });
    await waitFor(() => expect(tracks[0].stop).toHaveBeenCalledTimes(1));
  });

  it("una foto o ubicación que termina después de guardar no se adjunta a la siguiente inspección", async () => {
    let finishPhoto: ((value: Awaited<ReturnType<DeviceAdapters["photoFromFile"]>>) => void) | undefined;
    let finishLocation: ((value: Awaited<ReturnType<DeviceAdapters["requestLocation"]>>) => void) | undefined;
    const { view, onChange } = renderEvidence({
      ...unavailableDevices(),
      photoFromFile: () => new Promise((resolve) => { finishPhoto = resolve; }),
      requestLocation: () => new Promise((resolve) => { finishLocation = resolve; }),
    });
    fireEvent.change(screen.getByLabelText("Elegir imagen"), { target: { files: [syntheticFile()] } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar ubicación aproximada" }));
    view.unmount();
    finishPhoto?.({ status: "ok", photo: syntheticPhoto() });
    finishLocation?.({ status: "ok", location: ROUNDED_LOCATION });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("apaga la cámara al ocultar la pestaña y al desmontar el formulario", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const first = fakeStream(1);
    const second = fakeStream(1);
    const openCameraMock = vi.fn()
      .mockResolvedValueOnce({ status: "ready", stream: first.stream })
      .mockResolvedValueOnce({ status: "ready", stream: second.stream });
    const { view } = renderEvidence({ ...unavailableDevices(), canUseLiveCamera: () => true, openCamera: openCameraMock });

    fireEvent.click(await screen.findByRole("button", { name: "Abrir cámara" }));
    await screen.findByLabelText("Vista previa de la cámara");
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    expect(first.tracks[0].stop).toHaveBeenCalled();
    expect(await screen.findByText("Cámara cerrada al ocultar la página.")).toBeTruthy();
    visibility.mockRestore();

    fireEvent.click(await screen.findByRole("button", { name: "Abrir cámara" }));
    await screen.findByLabelText("Vista previa de la cámara");
    view.unmount();
    expect(second.tracks[0].stop).toHaveBeenCalled();
  });

  it("los avisos del sistema se activan solo con el botón y explican el fallback", async () => {
    const api = fakeNotificationApi("default");
    render(createElement(NotificationPreferences, { env: { Notification: api.NotificationApi } }));
    expect(api.requestPermission).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Activar avisos" }));
    await waitFor(() => expect(screen.getByTestId("notification-state").textContent).toContain("Avisos del sistema activados"));
    expect(api.requestPermission).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Activar avisos" })).toBeNull();
    cleanup();

    render(createElement(NotificationPreferences, { env: { Notification: fakeNotificationApi("denied").NotificationApi } }));
    expect((await screen.findByTestId("notification-state")).textContent).toContain("Los cambios se anuncian en esta página");
    expect(screen.queryByRole("button", { name: "Activar avisos" })).toBeNull();
    cleanup();

    render(createElement(NotificationPreferences, { env: {} }));
    expect((await screen.findByTestId("notification-state")).textContent).toContain("no ofrece notificaciones");
  });
});

// ---------------------------------------------------------------------------------------------
// CAP-06 · Flujo útil con y sin capacidades
// ---------------------------------------------------------------------------------------------

describe("CAP-06 integración con la captura offline de la Semana 5", () => {
  it("la evidencia viaja con la mutación y cada cambio genera un aviso", async () => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    const server = stubSyncServer();
    const api = fakeNotificationApi("granted");
    const devices: Partial<DeviceAdapters> = {
      ...unavailableDevices(),
      requestLocation: async () => ({ status: "ok", location: ROUNDED_LOCATION }),
      photoFromFile: async () => ({ status: "ok", photo: syntheticPhoto("file") }),
    };
    render(createElement(InspectionCaptureClient, { devices, notifications: { Notification: api.NotificationApi } }));
    await screen.findByText("Sincronización terminada.");

    fireEvent.change(screen.getByLabelText("Laboratorio sintético"), { target: { value: "Laboratorio de Software" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar ubicación aproximada" }));
    await screen.findByText("Ubicación aproximada agregada (±100 m).");
    fireEvent.change(screen.getByLabelText("Elegir imagen"), { target: { files: [syntheticFile()] } });
    await screen.findByAltText("Foto de evidencia adjunta a la inspección");

    fireEvent.click(screen.getByRole("button", { name: "Guardar sin conexión" }));
    await waitFor(() => expect(screen.getByTestId("capture-notice").textContent).toBe("Sincronización completada. 1 inspección enviada al servidor."));

    expect(server.bodies).toHaveLength(1);
    const sent = server.bodies[0].inspection as Record<string, any>;
    expect(sent.location).toBe("Laboratorio de Software");
    expect(sent.evidence.location).toEqual(ROUNDED_LOCATION);
    expect(sent.evidence.photo).toMatchObject({ mimeType: "image/jpeg", width: 1280, height: 960 });
    expect(JSON.stringify(server.bodies[0])).not.toContain("IMG_");
    expect(api.constructed.map(([title]) => title)).toEqual(["Inspección guardada", "Sincronización completada"]);

    // Regresión: el formulario y la evidencia se reinician después del primer await.
    expect((screen.getByLabelText("Laboratorio sintético") as HTMLInputElement).value).toBe("Laboratorio de Redes");
    expect(screen.queryByAltText("Foto de evidencia adjunta a la inspección")).toBeNull();
    expect(screen.queryByText("18.123, -97.654 · ±100 m")).toBeNull();
  });

  it("sin ninguna capacidad la inspección se guarda y sincroniza igual, con aviso en la página", async () => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    const server = stubSyncServer();
    render(createElement(InspectionCaptureClient, { devices: unavailableDevices(), notifications: {} }));
    await screen.findByText("Sincronización terminada.");

    fireEvent.click(screen.getByRole("button", { name: "Agregar ubicación aproximada" }));
    await screen.findByText("Este navegador no ofrece geolocalización. Puedes guardar la inspección sin ubicación.");
    fireEvent.click(screen.getByRole("button", { name: "Guardar sin conexión" }));
    await waitFor(() => expect(server.bodies).toHaveLength(1));
    expect(server.bodies[0].inspection).not.toHaveProperty("evidence");
    expect(screen.getByTestId("capture-notice").textContent).toBe("Sincronización completada. 1 inspección enviada al servidor.");
  });

  it("sin red conserva la evidencia en la cola y avisa que se enviará después", async () => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    const server = stubSyncServer();
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    const devices: Partial<DeviceAdapters> = {
      ...unavailableDevices(),
      requestLocation: async () => ({ status: "ok", location: ROUNDED_LOCATION }),
    };
    render(createElement(InspectionCaptureClient, { devices, notifications: {} }));
    await screen.findByText("Captura local lista.");

    fireEvent.click(screen.getByRole("button", { name: "Agregar ubicación aproximada" }));
    await screen.findByText("Ubicación aproximada agregada (±100 m).");
    fireEvent.click(screen.getByRole("button", { name: "Guardar sin conexión" }));

    expect(await screen.findByText(/Pendiente de sincronizar · con ubicación aproximada/)).toBeTruthy();
    expect(screen.getByTestId("capture-notice").textContent).toContain("guardada sin conexión; se enviará al volver la red.");
    expect(server.fetchMock).not.toHaveBeenCalled();
  });
});
