/**
 * Evidencia fotográfica opcional para una inspección (docs/capabilities.md, CAP-01).
 *
 * Dos caminos, del menos al más privilegiado:
 * 1. Selector de archivo (`<input type="file">`): la página no recibe acceso a la cámara; en un
 *    teléfono el sistema ofrece tomar la foto. Siempre está disponible y es el fallback.
 * 2. Cámara en vivo (`getUserMedia`): solo después de pulsar «Abrir cámara», solo video (sin
 *    audio), cámara trasera preferida y resolución moderada. Los tracks se detienen al capturar,
 *    al cerrar, al ocultar la pestaña y al desmontar el componente.
 *
 * Toda foto se vuelve a codificar en un canvas como JPEG de máximo 1280 px. Así se descartan los
 * metadatos EXIF (pueden incluir coordenadas GPS, modelo del equipo y fecha) y se limita lo que se
 * guarda en IndexedDB y se envía al sincronizar. No se conserva el nombre original del archivo.
 */

export const PHOTO_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PHOTO_ACCEPT_ATTRIBUTE = PHOTO_ACCEPTED_TYPES.join(",");
/** Límite de entrada: una foto de teléfono suele pesar entre 2 y 6 MB. */
export const PHOTO_MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const PHOTO_MAX_DIMENSION = 1280;
export const PHOTO_JPEG_QUALITY = 0.8;
/** Límite de lo que se guarda y se envía por cada inspección. */
export const PHOTO_MAX_OUTPUT_BYTES = 1024 * 1024;

export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
};

export type EvidencePhoto = {
  mimeType: "image/jpeg";
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
  source: "camera" | "file";
  capturedAt: string;
};

export type PhotoFailure = "empty" | "unsupported-type" | "too-large" | "processing-unavailable" | "processing-failed";

export type PhotoResult =
  | { status: "ok"; photo: EvidencePhoto }
  | { status: PhotoFailure; message: string };

export type CameraFailure = "unsupported" | "insecure-context" | "denied" | "not-found" | "busy" | "error";

export type CameraOpenResult =
  | { status: "ready"; stream: MediaStream }
  | { status: CameraFailure; message: string };

export type CameraEnvironment = {
  mediaDevices?: { getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream> };
  isSecureContext?: boolean;
};

/** Imagen ya decodificada (ImageBitmap o un <video> con cuadro) y sus dimensiones. */
export type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release?: () => void;
};

/** Adaptador del navegador para decodificar y volver a codificar. Las pruebas lo sustituyen. */
export interface PhotoCodec {
  decode(file: Blob): Promise<DecodedImage>;
  encodeJpeg(image: DecodedImage, width: number, height: number, quality: number): Promise<string>;
}

export type VideoFrameSource = CanvasImageSource & { videoWidth: number; videoHeight: number };

type StoppableStream = { getTracks(): Array<{ stop(): void }> };

export const CAMERA_MESSAGES: Record<CameraFailure, string> = {
  unsupported: "Este navegador no permite usar la cámara en vivo. Usa «Elegir imagen».",
  "insecure-context": "La cámara solo funciona con HTTPS o en localhost. Usa «Elegir imagen».",
  denied: "Permiso de cámara denegado. Puedes usar «Elegir imagen» o guardar sin foto.",
  "not-found": "No se encontró una cámara disponible. Usa «Elegir imagen».",
  busy: "La cámara está ocupada por otra aplicación. Ciérrala o usa «Elegir imagen».",
  error: "No se pudo abrir la cámara. Usa «Elegir imagen» o guarda sin foto.",
};

export const PHOTO_MESSAGES: Record<PhotoFailure, string> = {
  empty: "El archivo está vacío. Elige otra imagen.",
  "unsupported-type": "Formato no admitido. Usa una imagen JPG, PNG o WebP.",
  "too-large": "La imagen supera el límite (10 MB al elegirla, 1 MB ya procesada). Elige otra imagen.",
  "processing-unavailable": "Este navegador no puede procesar la imagen. Guarda la inspección sin foto.",
  "processing-failed": "No se pudo procesar la imagen. Intenta con otra o guarda sin foto.",
};

export function browserCameraEnvironment(): CameraEnvironment {
  if (typeof window === "undefined" || typeof navigator === "undefined") return {};
  return { mediaDevices: navigator.mediaDevices, isSecureContext: window.isSecureContext };
}

export function canUseLiveCamera(env: CameraEnvironment = browserCameraEnvironment()): boolean {
  return env.isSecureContext !== false && typeof env.mediaDevices?.getUserMedia === "function";
}

export function classifyCameraError(error: unknown): CameraFailure {
  const name = error && typeof error === "object" && "name" in error ? String((error as { name: unknown }).name) : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "denied";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "not-found";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "busy";
    default:
      return "error";
  }
}

function cameraFailure(status: CameraFailure): CameraOpenResult {
  return { status, message: CAMERA_MESSAGES[status] };
}

/** Abre la cámara en vivo. Llamar solo desde un manejador de clic. Nunca rechaza. */
export async function openCamera(env: CameraEnvironment = browserCameraEnvironment()): Promise<CameraOpenResult> {
  const getUserMedia = env.mediaDevices?.getUserMedia;
  if (typeof getUserMedia !== "function") return cameraFailure("unsupported");
  if (env.isSecureContext === false) return cameraFailure("insecure-context");
  try {
    const stream = await getUserMedia.call(env.mediaDevices, CAMERA_CONSTRAINTS);
    return { status: "ready", stream };
  } catch (error) {
    return cameraFailure(classifyCameraError(error));
  }
}

/** Detiene todos los tracks (apaga el indicador de cámara). Devuelve cuántos detuvo. */
export function stopCamera(stream: StoppableStream | null | undefined): number {
  if (!stream) return 0;
  const tracks = stream.getTracks();
  tracks.forEach((track) => track.stop());
  return tracks.length;
}

export function validatePhotoFile(file: { type: string; size: number }): PhotoFailure | null {
  if (file.size <= 0) return "empty";
  if (!(PHOTO_ACCEPTED_TYPES as readonly string[]).includes(file.type)) return "unsupported-type";
  if (file.size > PHOTO_MAX_INPUT_BYTES) return "too-large";
  return null;
}

/** Escala para que el lado mayor no supere `max`, sin agrandar y conservando la proporción. */
export function fitWithin(width: number, height: number, max: number = PHOTO_MAX_DIMENSION): { width: number; height: number } | null {
  if (!(width > 0) || !(height > 0)) return null;
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Bytes reales que representa un data URL en base64. */
export function dataUrlByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return 0;
  const base64 = dataUrl.slice(comma + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function browserPhotoCodec(): PhotoCodec | null {
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") return null;
  return {
    async decode(file) {
      // `createImageBitmap` respeta la orientación EXIF al decodificar; el EXIF no pasa al JPEG nuevo.
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    },
    async encodeJpeg(image, width, height, quality) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas 2D no disponible");
      context.fillStyle = "#ffffff"; // JPEG no tiene transparencia: fondo blanco en lugar de negro
      context.fillRect(0, 0, width, height);
      context.drawImage(image.source, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      canvas.width = 0; // libera la memoria del canvas
      canvas.height = 0;
      return dataUrl;
    },
  };
}

function photoFailure(status: PhotoFailure): PhotoResult {
  return { status, message: PHOTO_MESSAGES[status] };
}

async function encodeEvidence(
  image: DecodedImage,
  source: EvidencePhoto["source"],
  codec: PhotoCodec,
  now: () => Date,
): Promise<PhotoResult> {
  const size = fitWithin(image.width, image.height);
  if (!size) return photoFailure("processing-failed");
  const dataUrl = await codec.encodeJpeg(image, size.width, size.height, PHOTO_JPEG_QUALITY);
  if (!dataUrl.startsWith("data:image/jpeg;base64,")) return photoFailure("processing-failed");
  const bytes = dataUrlByteLength(dataUrl);
  if (bytes > PHOTO_MAX_OUTPUT_BYTES) return photoFailure("too-large");
  return {
    status: "ok",
    photo: { mimeType: "image/jpeg", dataUrl, width: size.width, height: size.height, bytes, source, capturedAt: now().toISOString() },
  };
}

/** Valida, reduce y limpia una imagen elegida con el selector de archivos. Nunca rechaza. */
export async function photoFromFile(
  file: Blob,
  codec: PhotoCodec | null = browserPhotoCodec(),
  now: () => Date = () => new Date(),
): Promise<PhotoResult> {
  const invalid = validatePhotoFile(file);
  if (invalid) return photoFailure(invalid);
  if (!codec) return photoFailure("processing-unavailable");

  let decoded: DecodedImage | undefined;
  try {
    decoded = await codec.decode(file);
    return await encodeEvidence(decoded, "file", codec, now);
  } catch {
    return photoFailure("processing-failed");
  } finally {
    decoded?.release?.();
  }
}

/** Toma el cuadro actual de la cámara en vivo. Nunca rechaza. */
export async function photoFromVideo(
  video: VideoFrameSource,
  codec: PhotoCodec | null = browserPhotoCodec(),
  now: () => Date = () => new Date(),
): Promise<PhotoResult> {
  if (!codec) return photoFailure("processing-unavailable");
  if (!video.videoWidth || !video.videoHeight) return photoFailure("processing-failed"); // aún sin cuadro
  try {
    return await encodeEvidence({ source: video, width: video.videoWidth, height: video.videoHeight }, "camera", codec, now);
  } catch {
    return photoFailure("processing-failed");
  }
}
