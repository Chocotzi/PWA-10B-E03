/**
 * Límites de seguridad compartidos por el cliente (atributos del formulario) y el servidor
 * (validación estricta). Una sola fuente de verdad evita que ambos lados se desincronicen.
 * Semana 9 · amenazas T-01, T-02.
 */
export const MAX_ID_LENGTH = 64;
export const MAX_LOCATION_LENGTH = 80;
export const MAX_INSPECTOR_LENGTH = 80;
export const MAX_SUMMARY_LENGTH = 500;
export const MAX_STATUS_LABEL_LENGTH = 40;
export const MAX_FINDINGS = 1000;

/** Una foto procesada pesa como máximo 1 MiB (mismo valor que `PHOTO_MAX_OUTPUT_BYTES`). */
export const MAX_PHOTO_BYTES = 1024 * 1024;
export const MAX_PHOTO_DIMENSION = 1280;
/** Base64 de MAX_PHOTO_BYTES más el prefijo del data URL. */
export const MAX_PHOTO_DATA_URL_LENGTH = Math.ceil(MAX_PHOTO_BYTES / 3) * 4 + 64;

/** Tope real de bytes del cuerpo de una petición de escritura (foto + metadatos + margen). */
export const MAX_BODY_BYTES = 2 * 1024 * 1024;

/** Tamaño máximo de los registros en memoria del servidor de demostración. */
export const MAX_TRACKED_REVISIONS = 5000;
export const MAX_TRACKED_ACKNOWLEDGEMENTS = 5000;

export const JPEG_DATA_URL_PREFIX = "data:image/jpeg;base64,";
