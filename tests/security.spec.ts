import { describe, expect, it } from "vitest";
import { inspections } from "../src/lib/data/inspections";
import { PHOTO_MAX_DIMENSION, PHOTO_MAX_OUTPUT_BYTES } from "../src/lib/device/camera";
import {
  JPEG_DATA_URL_PREFIX,
  MAX_BODY_BYTES,
  MAX_FINDINGS,
  MAX_PHOTO_BYTES,
  MAX_PHOTO_DIMENSION,
  MAX_SUMMARY_LENGTH,
  createBoundedMap,
  hasJsonContentType,
  isIsoDate,
  isSameOriginRequest,
  readJsonBody,
  validateMutation,
} from "../src/lib/security";

// Semana 9 · bloque 1 (Benkis): validación estricta de entradas y utilidades HTTP.
// Los bloques de headers/credenciales (Carlos) y privacidad (Cleber) se añaden como `describe` aparte.

function mutation(overrides: Record<string, unknown> = {}, inspection: Record<string, unknown> = {}) {
  return {
    id: "mutation-sec-1",
    baseRevision: null,
    createdAt: "2026-10-04T00:00:00.000Z",
    status: "pending",
    inspection: { ...inspections[0], id: "synthetic-sec-1", ...inspection },
    ...overrides,
  };
}

function fields(result: ReturnType<typeof validateMutation>): string[] {
  return result.ok ? [] : result.issues.map((issue) => issue.field);
}

const validPhoto = {
  mimeType: "image/jpeg",
  dataUrl: JPEG_DATA_URL_PREFIX + "AAAA",
  width: 640,
  height: 480,
  bytes: 3,
  source: "file",
  capturedAt: "2026-10-04T00:00:00.000Z",
};

describe("Semana 9 · Benkis · validación de entradas", () => {
  it("T-01 · acepta una mutación sintética válida, con y sin evidencia", () => {
    expect(validateMutation(mutation()).ok).toBe(true);
    const withEvidence = mutation({}, {
      evidence: { photo: validPhoto, location: { latitude: 18.465, longitude: -97.393, accuracyMeters: 100, capturedAt: "2026-10-04T00:00:00.000Z" } },
    });
    expect(validateMutation(withEvidence).ok).toBe(true);
  });

  it("T-01 · acepta todos los datos semilla del repositorio", () => {
    for (const seed of inspections) {
      expect(validateMutation(mutation({}, { ...seed })).ok).toBe(true);
    }
  });

  it("T-01 · rechaza cuerpos que no son objeto", () => {
    for (const body of [null, "texto", 42, [], [mutation()]]) {
      expect(validateMutation(body).ok).toBe(false);
    }
  });

  it("T-01 · rechaza tipos incorrectos y campos obligatorios ausentes", () => {
    expect(fields(validateMutation(mutation({ id: 7 })))).toContain("id");
    expect(fields(validateMutation(mutation({}, { findings: "2" })))).toContain("inspection.findings");
    expect(fields(validateMutation(mutation({}, { location: ["x"] })))).toContain("inspection.location");
    const missing = mutation() as Record<string, unknown>;
    delete missing.createdAt;
    expect(fields(validateMutation(missing))).toContain("createdAt");
  });

  it("T-01 · aplica longitudes máximas a laboratorio, responsable y resumen", () => {
    expect(fields(validateMutation(mutation({}, { location: "L".repeat(81) })))).toContain("inspection.location");
    expect(fields(validateMutation(mutation({}, { inspector: "R".repeat(81) })))).toContain("inspection.inspector");
    expect(fields(validateMutation(mutation({}, { summary: "S".repeat(MAX_SUMMARY_LENGTH + 1) })))).toContain("inspection.summary");
    expect(validateMutation(mutation({}, { summary: "S".repeat(MAX_SUMMARY_LENGTH) })).ok).toBe(true);
    expect(fields(validateMutation(mutation({}, { summary: "   " })))).toContain("inspection.summary");
  });

  it("T-01 · rechaza caracteres de control y ids con formato inesperado", () => {
    expect(fields(validateMutation(mutation({}, { location: "Lab\u0000X" })))).toContain("inspection.location");
    expect(fields(validateMutation(mutation({ id: "../../etc/passwd" })))).toContain("id");
    expect(fields(validateMutation(mutation({ id: "a".repeat(65) })))).toContain("id");
  });

  it("T-01 · restringe estado, hallazgos y fechas", () => {
    expect(fields(validateMutation(mutation({}, { status: "critical" })))).toContain("inspection.status");
    for (const findings of [-1, 1.5, MAX_FINDINGS + 1, Number.NaN, Infinity]) {
      expect(fields(validateMutation(mutation({}, { findings })))).toContain("inspection.findings");
    }
    expect(validateMutation(mutation({}, { findings: MAX_FINDINGS })).ok).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("04/10/2026")).toBe(false);
    expect(isIsoDate("2026-10-04")).toBe(true);
    expect(isIsoDate("2026-10-04T00:00:00.000Z")).toBe(true);
    expect(fields(validateMutation(mutation({}, { date: "mañana" })))).toContain("inspection.date");
    expect(fields(validateMutation(mutation({ createdAt: "ayer" })))).toContain("createdAt");
  });

  it("T-01 · rechaza claves desconocidas, incluidas __proto__ y constructor", () => {
    expect(fields(validateMutation(mutation({ admin: true })))).toContain("(clave)");
    expect(fields(validateMutation(mutation({}, { role: "admin" })))).toContain("inspection.(clave)");

    const polluted = JSON.parse('{"id":"m1","baseRevision":null,"createdAt":"2026-10-04","status":"pending","__proto__":{"admin":true},"inspection":{}}');
    expect(validateMutation(polluted).ok).toBe(false);
    const ctor = JSON.parse('{"constructor":{"prototype":{"x":1}}}');
    expect(validateMutation(ctor).ok).toBe(false);
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
  });

  it("T-03 · los errores identifican el campo pero nunca devuelven el valor recibido", () => {
    const secret = "VALOR-SINTETICO-NO-ECO";
    const result = validateMutation(mutation({ status: secret, admin: secret }, { findings: secret, summary: secret + "x".repeat(600) }));
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("T-01 · la foto solo admite image/jpeg con prefijo data URL correcto", () => {
    const withPhoto = (photo: Record<string, unknown>) => validateMutation(mutation({}, { evidence: { photo: { ...validPhoto, ...photo } } }));
    expect(withPhoto({}).ok).toBe(true);
    expect(fields(withPhoto({ mimeType: "image/png" }))).toContain("inspection.evidence.photo.mimeType");
    expect(fields(withPhoto({ dataUrl: "data:image/png;base64,AAAA" }))).toContain("inspection.evidence.photo.dataUrl");
    expect(fields(withPhoto({ dataUrl: "data:text/html;base64,PHNjcmlwdD4=" }))).toContain("inspection.evidence.photo.dataUrl");
    expect(fields(withPhoto({ dataUrl: "javascript:alert(1)" }))).toContain("inspection.evidence.photo.dataUrl");
    expect(fields(withPhoto({ dataUrl: JPEG_DATA_URL_PREFIX + "no base64!" }))).toContain("inspection.evidence.photo.dataUrl");
    expect(fields(withPhoto({ source: "drone" }))).toContain("inspection.evidence.photo.source");
  });

  it("T-02 · la foto respeta tamaño máximo y dimensiones", () => {
    const withPhoto = (photo: Record<string, unknown>) => validateMutation(mutation({}, { evidence: { photo: { ...validPhoto, ...photo } } }));
    const huge = JPEG_DATA_URL_PREFIX + "A".repeat(Math.ceil(MAX_PHOTO_BYTES / 3) * 4 + 128);
    expect(fields(withPhoto({ dataUrl: huge }))).toContain("inspection.evidence.photo.dataUrl");
    expect(fields(withPhoto({ bytes: MAX_PHOTO_BYTES + 1 }))).toContain("inspection.evidence.photo.bytes");
    expect(fields(withPhoto({ width: MAX_PHOTO_DIMENSION + 1 }))).toContain("inspection.evidence.photo.width");
    expect(fields(withPhoto({ height: 0 }))).toContain("inspection.evidence.photo.height");
  });

  it("T-01 · la ubicación respeta rangos de latitud y longitud", () => {
    const withLocation = (location: Record<string, unknown>) => validateMutation(mutation({}, {
      evidence: { location: { latitude: 18.465, longitude: -97.393, accuracyMeters: 100, capturedAt: "2026-10-04T00:00:00.000Z", ...location } },
    }));
    expect(withLocation({}).ok).toBe(true);
    expect(fields(withLocation({ latitude: 91 }))).toContain("inspection.evidence.location.latitude");
    expect(fields(withLocation({ longitude: -181 }))).toContain("inspection.evidence.location.longitude");
    expect(fields(withLocation({ latitude: "18.4" }))).toContain("inspection.evidence.location.latitude");
    expect(fields(withLocation({ extra: 1 }))).toContain("inspection.evidence.location.(clave)");
  });

  it("T-02 · los límites de seguridad coinciden con los del módulo de cámara", () => {
    expect(MAX_PHOTO_BYTES).toBe(PHOTO_MAX_OUTPUT_BYTES);
    expect(MAX_PHOTO_DIMENSION).toBe(PHOTO_MAX_DIMENSION);
  });
});

describe("Semana 9 · Benkis · utilidades HTTP", () => {
  function post(body: BodyInit | null, headers: Record<string, string> = {}) {
    return new Request("http://localhost/api/inspecciones", { method: "POST", headers, body });
  }

  it("T-04 · exige Content-Type application/json (admite charset)", () => {
    expect(hasJsonContentType(post("{}", { "Content-Type": "application/json" }))).toBe(true);
    expect(hasJsonContentType(post("{}", { "Content-Type": "application/json; charset=utf-8" }))).toBe(true);
    expect(hasJsonContentType(post("{}", { "Content-Type": "text/plain" }))).toBe(false);
    expect(hasJsonContentType(post("{}", { "Content-Type": "application/x-www-form-urlencoded" }))).toBe(false);
    expect(hasJsonContentType(new Request("http://localhost/x", { method: "POST" }))).toBe(false);
  });

  it("T-04 · same-origin: acepta mismo origen y rechaza orígenes cruzados", () => {
    expect(isSameOriginRequest(post("{}"))).toBe(true);
    expect(isSameOriginRequest(post("{}", { Origin: "http://localhost" }))).toBe(true);
    expect(isSameOriginRequest(post("{}", { Origin: "https://evil.example" }))).toBe(false);
    expect(isSameOriginRequest(post("{}", { Origin: "null" }))).toBe(false);
    expect(isSameOriginRequest(post("{}", { "Sec-Fetch-Site": "same-origin" }))).toBe(true);
    expect(isSameOriginRequest(post("{}", { "Sec-Fetch-Site": "cross-site" }))).toBe(false);
    expect(isSameOriginRequest(post("{}", { "Sec-Fetch-Site": "same-site" }))).toBe(false);
    // Sec-Fetch-Site manda sobre un Origin que parezca válido.
    expect(isSameOriginRequest(post("{}", { "Sec-Fetch-Site": "cross-site", Origin: "http://localhost" }))).toBe(false);
  });

  it("T-02 · readJsonBody lee JSON válido", async () => {
    const result = await readJsonBody(post('{"a":1}', { "Content-Type": "application/json" }));
    expect(result).toEqual({ ok: true, value: { a: 1 } });
  });

  it("T-02 · readJsonBody corta por bytes reales aunque Content-Length mienta", async () => {
    const big = JSON.stringify({ pad: "x".repeat(2000) });
    const lying = post(big, { "Content-Type": "application/json", "Content-Length": "10" });
    expect(await readJsonBody(lying, 1000)).toEqual({ ok: false, code: "payload_too_large" });
    const declared = post("{}", { "Content-Type": "application/json", "Content-Length": String(MAX_BODY_BYTES + 1) });
    expect(await readJsonBody(declared)).toEqual({ ok: false, code: "payload_too_large" });
  });

  it("T-02 · readJsonBody rechaza JSON roto, UTF-8 inválido y cuerpo vacío", async () => {
    expect(await readJsonBody(post("{no json", { "Content-Type": "application/json" }))).toEqual({ ok: false, code: "bad_request" });
    expect(await readJsonBody(post(new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]), { "Content-Type": "application/json" }))).toEqual({ ok: false, code: "bad_request" });
    expect(await readJsonBody(post(null, { "Content-Type": "application/json" }))).toEqual({ ok: false, code: "bad_request" });
  });

  it("T-02 · el mapa acotado descarta lo más antiguo y renueva claves reescritas", () => {
    const map = createBoundedMap<string, number>(3);
    map.set("a", 1).set("b", 2).set("c", 3);
    map.set("a", 10); // a pasa a ser la más reciente
    map.set("d", 4); // descarta b
    expect(Array.from(map.keys())).toEqual(["c", "a", "d"]);
    expect(map.size).toBe(3);
    expect(() => createBoundedMap(0)).toThrow(RangeError);
  });
});
