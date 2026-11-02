import {
  JPEG_DATA_URL_PREFIX,
  MAX_FINDINGS,
  MAX_ID_LENGTH,
  MAX_INSPECTOR_LENGTH,
  MAX_LOCATION_LENGTH,
  MAX_PHOTO_BYTES,
  MAX_PHOTO_DATA_URL_LENGTH,
  MAX_PHOTO_DIMENSION,
  MAX_STATUS_LABEL_LENGTH,
  MAX_SUMMARY_LENGTH,
} from "./limits";
import type { PendingMutation } from "../storage/schema";

/**
 * Validación estricta, sin dependencias, de una mutación de inspección (T-01).
 * Reglas: tipos y longitudes exactos, claves desconocidas rechazadas (incluidas `__proto__` y
 * `constructor`) y errores por campo que nunca devuelven el valor recibido.
 */
export type ValidationIssue = { field: string; code: string };

export type ValidationResult =
  | { ok: true; value: PendingMutation }
  | { ok: false; issues: ValidationIssue[] };

/**
 * Claves admitidas por nivel. Se exportan para que el inventario de privacidad (`privacy.ts`) y sus
 * pruebas detecten cualquier campo nuevo que no esté documentado.
 */
export const MUTATION_KEYS = { required: ["id", "inspection", "baseRevision", "createdAt", "status"], optional: ["serverRevision"] };
export const INSPECTION_KEYS = {
  required: ["id", "location", "date", "inspector", "status", "statusLabel", "findings", "summary"],
  optional: ["evidence"],
};
export const EVIDENCE_KEYS = { required: [] as string[], optional: ["photo", "location"] };
export const PHOTO_KEYS = { required: ["mimeType", "dataUrl", "width", "height", "bytes", "source", "capturedAt"], optional: [] as string[] };
export const LOCATION_KEYS = { required: ["latitude", "longitude", "accuracyMeters", "capturedAt"], optional: [] as string[] };

const ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function hasControlCharacters(text: string, allowNewlines: boolean): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code === 127) return true;
    if (code < 32 && !(allowNewlines && (code === 10 || code === 13 || code === 9))) return true;
  }
  return false;
}

export function isIsoDate(value: string): boolean {
  if (DATE_ONLY.test(value)) {
    const parsed = new Date(value + "T00:00:00.000Z");
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }
  if (DATE_TIME.test(value)) {
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value.slice(0, 10);
  }
  return false;
}

function isBase64(text: string): boolean {
  if (text.length % 4 !== 0) return false;
  let padding = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    const isLetter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    const isDigit = code >= 48 && code <= 57;
    if (isLetter || isDigit || code === 43 || code === 47) {
      if (padding > 0) return false;
    } else if (code === 61) {
      padding += 1;
      if (padding > 2) return false;
    } else {
      return false;
    }
  }
  return true;
}

class Collector {
  readonly issues: ValidationIssue[] = [];
  add(field: string, code: string) { this.issues.push({ field, code }); }

  /** Rechaza cualquier clave fuera de la lista permitida. */
  exactKeys(object: PlainObject, path: string, required: string[], optional: string[]) {
    const keys = Object.keys(object);
    for (let i = 0; i < keys.length; i += 1) {
      if (required.indexOf(keys[i]) < 0 && optional.indexOf(keys[i]) < 0) {
        this.add(path ? path + "." + "(clave)" : "(clave)", "unknown_key");
      }
    }
    for (let i = 0; i < required.length; i += 1) {
      if (!Object.prototype.hasOwnProperty.call(object, required[i])) {
        this.add(path ? path + "." + required[i] : required[i], "required");
      }
    }
  }

  text(object: PlainObject, key: string, path: string, max: number, allowNewlines = false): string | null {
    const field = path ? path + "." + key : key;
    const value = object[key];
    if (typeof value !== "string") { this.add(field, "type"); return null; }
    if (value.trim().length === 0) { this.add(field, "empty"); return null; }
    if (value.length > max) { this.add(field, "too_long"); return null; }
    if (hasControlCharacters(value, allowNewlines)) { this.add(field, "control_characters"); return null; }
    return value;
  }

  identifier(object: PlainObject, key: string, path: string): string | null {
    const field = path ? path + "." + key : key;
    const value = object[key];
    if (typeof value !== "string") { this.add(field, "type"); return null; }
    if (value.length === 0) { this.add(field, "empty"); return null; }
    if (value.length > MAX_ID_LENGTH) { this.add(field, "too_long"); return null; }
    if (!ID_PATTERN.test(value)) { this.add(field, "format"); return null; }
    return value;
  }

  date(object: PlainObject, key: string, path: string): void {
    const field = path ? path + "." + key : key;
    const value = object[key];
    if (typeof value !== "string") { this.add(field, "type"); return; }
    if (!isIsoDate(value)) this.add(field, "format");
  }

  integer(object: PlainObject, key: string, path: string, min: number, max: number): void {
    const field = path ? path + "." + key : key;
    const value = object[key];
    if (typeof value !== "number" || !Number.isInteger(value)) { this.add(field, "type"); return; }
    if (value < min || value > max) this.add(field, "range");
  }

  decimal(object: PlainObject, key: string, path: string, min: number, max: number): void {
    const field = path ? path + "." + key : key;
    const value = object[key];
    if (typeof value !== "number" || !Number.isFinite(value)) { this.add(field, "type"); return; }
    if (value < min || value > max) this.add(field, "range");
  }
}

function validatePhoto(photo: unknown, c: Collector, path: string) {
  if (!isPlainObject(photo)) { c.add(path, "type"); return; }
  c.exactKeys(photo, path, PHOTO_KEYS.required, PHOTO_KEYS.optional);
  if (photo.mimeType !== undefined && photo.mimeType !== "image/jpeg") c.add(path + ".mimeType", "unsupported_type");
  if (photo.source !== undefined && photo.source !== "camera" && photo.source !== "file") c.add(path + ".source", "enum");
  if (photo.width !== undefined) c.integer(photo, "width", path, 1, MAX_PHOTO_DIMENSION);
  if (photo.height !== undefined) c.integer(photo, "height", path, 1, MAX_PHOTO_DIMENSION);
  if (photo.bytes !== undefined) c.integer(photo, "bytes", path, 0, MAX_PHOTO_BYTES);
  if (photo.capturedAt !== undefined) c.date(photo, "capturedAt", path);
  if (photo.dataUrl === undefined) return;
  const dataUrl = photo.dataUrl;
  const field = path + ".dataUrl";
  if (typeof dataUrl !== "string") { c.add(field, "type"); return; }
  if (dataUrl.length > MAX_PHOTO_DATA_URL_LENGTH) { c.add(field, "too_large"); return; }
  if (dataUrl.indexOf(JPEG_DATA_URL_PREFIX) !== 0) { c.add(field, "format"); return; }
  if (!isBase64(dataUrl.slice(JPEG_DATA_URL_PREFIX.length))) c.add(field, "format");
}

function validateLocation(location: unknown, c: Collector, path: string) {
  if (!isPlainObject(location)) { c.add(path, "type"); return; }
  c.exactKeys(location, path, LOCATION_KEYS.required, LOCATION_KEYS.optional);
  if (location.latitude !== undefined) c.decimal(location, "latitude", path, -90, 90);
  if (location.longitude !== undefined) c.decimal(location, "longitude", path, -180, 180);
  if (location.accuracyMeters !== undefined) c.decimal(location, "accuracyMeters", path, 0, 100000);
  if (location.capturedAt !== undefined) c.date(location, "capturedAt", path);
}

function validateInspection(inspection: unknown, c: Collector, path: string) {
  if (!isPlainObject(inspection)) { c.add(path, "type"); return; }
  c.exactKeys(inspection, path, INSPECTION_KEYS.required, INSPECTION_KEYS.optional);
  const has = (key: string) => Object.prototype.hasOwnProperty.call(inspection, key);
  if (has("id")) c.identifier(inspection, "id", path);
  if (has("location")) c.text(inspection, "location", path, MAX_LOCATION_LENGTH);
  if (has("inspector")) c.text(inspection, "inspector", path, MAX_INSPECTOR_LENGTH);
  if (has("statusLabel")) c.text(inspection, "statusLabel", path, MAX_STATUS_LABEL_LENGTH);
  if (has("summary")) c.text(inspection, "summary", path, MAX_SUMMARY_LENGTH, true);
  if (has("date")) c.date(inspection, "date", path);
  if (has("findings")) c.integer(inspection, "findings", path, 0, MAX_FINDINGS);
  if (has("status") && inspection.status !== "ok" && inspection.status !== "attention") {
    c.add(path + ".status", "enum");
  }
  if (has("evidence") && inspection.evidence !== undefined) {
    const evidence = inspection.evidence;
    if (!isPlainObject(evidence)) { c.add(path + ".evidence", "type"); return; }
    c.exactKeys(evidence, path + ".evidence", EVIDENCE_KEYS.required, EVIDENCE_KEYS.optional);
    if (evidence.photo !== undefined) validatePhoto(evidence.photo, c, path + ".evidence.photo");
    if (evidence.location !== undefined) validateLocation(evidence.location, c, path + ".evidence.location");
  }
}

export function validateMutation(input: unknown): ValidationResult {
  const c = new Collector();
  if (!isPlainObject(input)) return { ok: false, issues: [{ field: "(cuerpo)", code: "type" }] };

  c.exactKeys(input, "", MUTATION_KEYS.required, MUTATION_KEYS.optional);
  const has = (key: string) => Object.prototype.hasOwnProperty.call(input, key);
  if (has("id")) c.identifier(input, "id", "");
  if (has("createdAt")) c.date(input, "createdAt", "");
  if (has("status") && input.status !== "pending" && input.status !== "conflict") c.add("status", "enum");
  if (has("baseRevision") && input.baseRevision !== null) c.identifier(input, "baseRevision", "");
  if (has("serverRevision") && input.serverRevision !== null && input.serverRevision !== undefined) {
    c.identifier(input, "serverRevision", "");
  }
  if (has("inspection")) validateInspection(input.inspection, c, "inspection");

  if (c.issues.length > 0) return { ok: false, issues: c.issues.slice(0, 20) };
  return { ok: true, value: input as unknown as PendingMutation };
}
