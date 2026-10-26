// Unit: Capacidades del dispositivo (cámara y geolocalización).
//
// Reescrito contra la API real de la Semana 6 (docs/capabilities.md, CAP-01/CAP-02). La versión
// anterior de este archivo probaba `captureImage`/`getCurrentLocation` (commit 62f9c36), que fue
// reemplazada por una implementación más completa: cámara en vivo + selector de archivo con
// recodificación a JPEG, y una sola lectura de ubicación aproximada que nunca inventa coordenadas
// sintéticas cuando la API falta o el permiso se niega (ver comentarios en camera.ts/geolocation.ts).
//
// Cada función acepta un entorno inyectado (`CameraEnvironment` / `GeolocationEnvironment`), así que
// las pruebas no necesitan jsdom ni `vi.stubGlobal("navigator", ...)`: se construye el entorno mínimo
// que cada caso necesita.
import { describe, it, expect, vi } from "vitest";
import {
  CAMERA_MESSAGES,
  PHOTO_MAX_DIMENSION,
  PHOTO_MESSAGES,
  canUseLiveCamera,
  openCamera,
  photoFromFile,
  stopCamera,
  validatePhotoFile,
  type CameraEnvironment,
  type PhotoCodec,
} from "../../src/lib/device/camera";
import {
  LOCATION_MESSAGES,
  MIN_ACCURACY_METERS,
  isGeolocationSupported,
  requestApproximateLocation,
  type GeolocationEnvironment,
} from "../../src/lib/device/geolocation";

describe("Unit: Device Capabilities (Camera & Geolocation Fallbacks)", () => {
  describe("Camera Capability", () => {
    it("canUseLiveCamera es false sin mediaDevices.getUserMedia o fuera de contexto seguro", () => {
      expect(canUseLiveCamera({})).toBe(false);
      expect(canUseLiveCamera({ mediaDevices: { getUserMedia: vi.fn() }, isSecureContext: false })).toBe(false);
      expect(canUseLiveCamera({ mediaDevices: { getUserMedia: vi.fn() }, isSecureContext: true })).toBe(true);
    });

    it("openCamera devuelve 'unsupported' cuando no hay getUserMedia (la UI cae al selector de archivo)", async () => {
      const result = await openCamera({});
      expect(result.status).toBe("unsupported");
      if (result.status !== "ready") expect(result.message).toBe(CAMERA_MESSAGES.unsupported);
    });

    it("openCamera devuelve 'insecure-context' fuera de HTTPS o localhost", async () => {
      const env: CameraEnvironment = { mediaDevices: { getUserMedia: vi.fn() }, isSecureContext: false };
      const result = await openCamera(env);
      expect(result.status).toBe("insecure-context");
      if (result.status !== "ready") expect(result.message).toBe(CAMERA_MESSAGES["insecure-context"]);
    });

    it("openCamera clasifica el permiso denegado y nunca lanza una excepción", async () => {
      const env: CameraEnvironment = {
        mediaDevices: { getUserMedia: vi.fn().mockRejectedValue({ name: "NotAllowedError" }) },
        isSecureContext: true,
      };
      const result = await openCamera(env);
      expect(result.status).toBe("denied");
      if (result.status !== "ready") expect(result.message).toBe(CAMERA_MESSAGES.denied);
    });

    it("openCamera devuelve el stream listo cuando el permiso se concede", async () => {
      const fakeStream = { getTracks: () => [] } as unknown as MediaStream;
      const env: CameraEnvironment = {
        mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
        isSecureContext: true,
      };
      const result = await openCamera(env);
      expect(result.status).toBe("ready");
      if (result.status === "ready") expect(result.stream).toBe(fakeStream);
    });

    it("stopCamera detiene todos los tracks para apagar el indicador de la cámara (privacidad)", () => {
      const stopFn = vi.fn();
      const stream = { getTracks: () => [{ stop: stopFn }, { stop: stopFn }] };
      const stopped = stopCamera(stream);
      expect(stopped).toBe(2);
      expect(stopFn).toHaveBeenCalledTimes(2);
    });

    it("stopCamera no falla cuando no hay stream que detener", () => {
      expect(stopCamera(null)).toBe(0);
      expect(stopCamera(undefined)).toBe(0);
    });
  });

  describe("Photo processing (selector de archivo)", () => {
    it("rechaza un tipo de archivo no soportado antes de intentar procesarlo", async () => {
      const file = { type: "application/pdf", size: 1024 } as unknown as Blob;
      const result = await photoFromFile(file, null);
      expect(result.status).toBe("unsupported-type");
      if (result.status !== "ok") expect(result.message).toBe(PHOTO_MESSAGES["unsupported-type"]);
    });

    it("validatePhotoFile rechaza archivos vacíos y demasiado grandes", () => {
      expect(validatePhotoFile({ type: "image/jpeg", size: 0 })).toBe("empty");
      expect(validatePhotoFile({ type: "image/jpeg", size: 11 * 1024 * 1024 })).toBe("too-large");
      expect(validatePhotoFile({ type: "image/jpeg", size: 1024 })).toBeNull();
    });

    it("devuelve 'processing-unavailable' cuando el navegador no puede recodificar imágenes", async () => {
      const file = { type: "image/jpeg", size: 1024 } as unknown as Blob;
      const result = await photoFromFile(file, null);
      expect(result.status).toBe("processing-unavailable");
      if (result.status !== "ok") expect(result.message).toBe(PHOTO_MESSAGES["processing-unavailable"]);
    });

    it("procesa y reduce una foto válida, descartando metadatos EXIF (fuente 'file')", async () => {
      const fakeCodec: PhotoCodec = {
        decode: async () => ({ source: {} as CanvasImageSource, width: 4000, height: 2000 }),
        encodeJpeg: async () => "data:image/jpeg;base64,AAAA",
      };
      const file = { type: "image/jpeg", size: 2 * 1024 * 1024 } as unknown as Blob;
      const result = await photoFromFile(file, fakeCodec, () => new Date("2026-01-01T00:00:00Z"));
      expect(result.status).toBe("ok");
      if (result.status === "ok") {
        expect(result.photo.source).toBe("file");
        expect(result.photo.mimeType).toBe("image/jpeg");
        expect(Math.max(result.photo.width, result.photo.height)).toBeLessThanOrEqual(PHOTO_MAX_DIMENSION);
      }
    });
  });

  describe("Geolocation Capability", () => {
    it("isGeolocationSupported es false sin navigator.geolocation.getCurrentPosition", () => {
      expect(isGeolocationSupported({})).toBe(false);
      expect(isGeolocationSupported({ geolocation: { getCurrentPosition: vi.fn() } })).toBe(true);
    });

    it("requestApproximateLocation devuelve 'unsupported' sin la API (nunca inventa coordenadas)", async () => {
      const result = await requestApproximateLocation({});
      expect(result.status).toBe("unsupported");
      if (result.status !== "ok") expect(result.message).toBe(LOCATION_MESSAGES.unsupported);
    });

    it("requestApproximateLocation devuelve 'insecure-context' fuera de HTTPS o localhost", async () => {
      const env: GeolocationEnvironment = {
        geolocation: { getCurrentPosition: vi.fn() },
        isSecureContext: false,
      };
      const result = await requestApproximateLocation(env);
      expect(result.status).toBe("insecure-context");
    });

    it("obtiene y redondea la ubicación cuando el navegador responde con éxito", async () => {
      const env: GeolocationEnvironment = {
        geolocation: {
          getCurrentPosition: (success) =>
            success({ coords: { latitude: 18.46271234, longitude: -97.39284321, accuracy: 15 } }),
        },
        now: () => new Date("2026-01-01T00:00:00Z"),
      };
      const result = await requestApproximateLocation(env);
      expect(result.status).toBe("ok");
      if (result.status === "ok") {
        // Redondeo a 3 decimales (±110 m): no se guarda más precisión de la real.
        expect(result.location.latitude).toBe(18.463);
        expect(result.location.longitude).toBe(-97.393);
        // La precisión declarada nunca es menor a MIN_ACCURACY_METERS, aunque el sensor reporte menos.
        expect(result.location.accuracyMeters).toBe(MIN_ACCURACY_METERS);
      }
    });

    it("clasifica el permiso de ubicación denegado como 'denied' sin lanzar", async () => {
      const env: GeolocationEnvironment = {
        geolocation: {
          getCurrentPosition: (_success, error) => error?.({ code: 1 }),
        },
      };
      const result = await requestApproximateLocation(env);
      expect(result.status).toBe("denied");
      if (result.status !== "ok") expect(result.message).toBe(LOCATION_MESSAGES.denied);
    });

    it("clasifica un código de error desconocido como 'error' genérico", async () => {
      const env: GeolocationEnvironment = {
        geolocation: {
          getCurrentPosition: (_success, error) => error?.({ code: 999 }),
        },
      };
      const result = await requestApproximateLocation(env);
      expect(result.status).toBe("error");
      if (result.status !== "ok") expect(result.message).toBe(LOCATION_MESSAGES.error);
    });
  });
});
