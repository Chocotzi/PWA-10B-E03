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

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Semana 9 · bloque 2 (Carlos): encabezados y CSP, credenciales y regresión del service worker.
// Amenazas T-05 a T-11 de docs/threat-model.md. Las muestras de credenciales se arman en tiempo de
// ejecución con `sample(...)`: este archivo no contiene ningún literal con forma de credencial, y la
// prueba «sin falsos positivos» lo pasa por el escáner junto con el resto del repositorio.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { vi } from "vitest";
import { CAMERA_CONSTRAINTS } from "../src/lib/device/camera";
import {
  HSTS_VALUE,
  PERMISSIONS_POLICY,
  REFERRER_POLICY,
  SERVICE_WORKER_CSP,
  buildCsp,
  nextHeaderRules,
  parseCsp,
  type HeaderRule,
} from "../src/lib/security/headers";
import { SECRET_RULES, isSensitiveFileName, scanForSecrets } from "../src/lib/security/secrets";
import { ORIGIN, assetRequest, createFakeNetwork, createServiceWorkerHarness, navigationRequest, pushData } from "./helpers/sw-harness";

const ROOT = resolve(__dirname, "..");

/** Directivas que la tarea exige con su valor exacto. */
const REQUIRED_CSP: Record<string, string[]> = {
  "default-src": ["'self'"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  "connect-src": ["'self'"],
  "worker-src": ["'self'"],
  "manifest-src": ["'self'"],
  "img-src": ["'self'", "data:", "blob:"],
};

function sourceMatches(source: string, path: string): boolean {
  if (source.endsWith("/:path*")) {
    const prefix = source.slice(0, -"/:path*".length);
    return path === prefix || path.startsWith(`${prefix}/`) || (prefix === "" && path.startsWith("/"));
  }
  return source === path;
}

/**
 * Encabezados que resultan para una ruta, como los combina Next.js: se aplican en orden las reglas cuyo
 * `source` y `has` coinciden y, si una clave se repite, gana la última. El E2E lo confirma contra `next start`.
 */
function effectiveHeaders(rules: HeaderRule[], path: string, request: Record<string, string> = {}): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rule of rules) {
    if (!sourceMatches(rule.source, path)) continue;
    const conditions = rule.has ?? [];
    const applies = conditions.every((condition) => {
      const value = request[condition.key.toLowerCase()];
      return value !== undefined && (condition.value === undefined || new RegExp(`^${condition.value}$`).test(value));
    });
    if (!applies) continue;
    for (const header of rule.headers) result[header.key.toLowerCase()] = header.value;
  }
  return result;
}

const DOCUMENT_PATHS = ["/", "/inspecciones", "/inspecciones/inspection-001", "/offline"];
const ALL_PATHS = [...DOCUMENT_PATHS, "/api/inspecciones", "/api/inspecciones/inspection-001", "/manifest.webmanifest", "/sw.js", "/robots.txt", "/_next/static/chunks/app.js"];

describe("Semana 9 · Carlos · encabezados y CSP", () => {
  it("T-05 · buildCsp incluye las directivas obligatorias con su valor exacto", () => {
    const csp = parseCsp(buildCsp({ production: true }));
    for (const [name, sources] of Object.entries(REQUIRED_CSP)) {
      expect(csp[name], name).toEqual(sources);
    }
    expect(csp["script-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    expect(csp["style-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    expect(buildCsp()).toBe(buildCsp({ production: true })); // sin argumentos, la política de producción
  });

  it("T-05 · ninguna directiva prohibida: sin comodines, esquemas abiertos ni dominios externos", () => {
    for (const production of [true, false]) {
      const csp = parseCsp(buildCsp({ production }));
      for (const [name, sources] of Object.entries(csp)) {
        for (const source of sources) {
          expect(source, `${name} no admite comodines`).not.toContain("*");
          expect(["http:", "https:", "ws:", "wss:", "filesystem:"], `${name} no abre un esquema completo`).not.toContain(source);
          expect(source, `${name} solo admite fuentes propias`).not.toMatch(/^(?:[a-z]+:)?\/\//i);
        }
      }
      expect(csp["script-src"]).not.toContain("data:");
      expect(csp["script-src"]).not.toContain("blob:");
    }
    expect(parseCsp(buildCsp({ production: true }))["script-src"]).not.toContain("'unsafe-eval'");
  });

  it("T-05 · en desarrollo solo cambia script-src, que agrega 'unsafe-eval' para React", () => {
    const production = parseCsp(buildCsp({ production: true }));
    const development = parseCsp(buildCsp({ production: false }));
    expect(development["script-src"]).toEqual([...production["script-src"], "'unsafe-eval'"]);
    expect({ ...development, "script-src": production["script-src"] }).toEqual(production);
  });

  it("T-05 · decisión: 'unsafe-inline' sin nonce, hash ni 'strict-dynamic'", () => {
    // Un nonce o un hash hacen que el navegador ignore 'unsafe-inline': las páginas estáticas
    // (/offline, /inspecciones) quedarían sin sus scripts. Cambiar esta decisión exige render dinámico.
    const scriptSrc = parseCsp(buildCsp())["script-src"];
    expect(scriptSrc).toContain("'unsafe-inline'");
    expect(scriptSrc.filter((source) => /^'(?:nonce|sha256|sha384|sha512)-/.test(source))).toEqual([]);
    expect(scriptSrc).not.toContain("'strict-dynamic'");
  });

  it("T-05 · parseCsp toma la primera aparición de una directiva, como el navegador", () => {
    expect(parseCsp("script-src 'self'; SCRIPT-SRC *;  ; object-src 'none'")).toEqual({
      "script-src": ["'self'"],
      "object-src": ["'none'"],
    });
  });

  it("T-06 · nosniff, X-Frame-Options, COOP, Referrer-Policy y frame-ancestors en todas las rutas", () => {
    const rules = nextHeaderRules({ production: true });
    for (const path of ALL_PATHS) {
      const headers = effectiveHeaders(rules, path);
      expect(headers["x-content-type-options"], path).toBe("nosniff");
      expect(headers["x-frame-options"], path).toBe("DENY");
      expect(headers["cross-origin-opener-policy"], path).toBe("same-origin");
      expect(headers["referrer-policy"], path).toBe(REFERRER_POLICY);
      expect(headers["permissions-policy"], path).toBe(PERMISSIONS_POLICY);
    }
    for (const path of DOCUMENT_PATHS) {
      const csp = parseCsp(effectiveHeaders(rules, path)["content-security-policy"]);
      expect(csp["frame-ancestors"], path).toEqual(["'none'"]);
    }
    expect(["no-referrer", "same-origin", "strict-origin", "strict-origin-when-cross-origin"]).toContain(REFERRER_POLICY);
  });

  it("T-11 · Permissions-Policy: cámara y ubicación solo del mismo origen, micrófono denegado", () => {
    const features = Object.fromEntries(PERMISSIONS_POLICY.split(",").map((entry) => entry.trim().split("=")));
    expect(features).toMatchObject({ camera: "(self)", geolocation: "(self)", microphone: "()" });
    for (const [feature, allowlist] of Object.entries(features)) {
      expect(["()", "(self)"], `${feature} no se abre a otros orígenes`).toContain(allowlist);
    }
    // La captura de la Semana 6 solo pide video: negar el micrófono no rompe la cámara.
    expect(CAMERA_CONSTRAINTS.audio).toBe(false);
  });

  it("HSTS solo en producción y solo cuando el proxy indica HTTPS", () => {
    const production = nextHeaderRules({ production: true });
    expect(effectiveHeaders(production, "/")["strict-transport-security"]).toBeUndefined();
    expect(effectiveHeaders(production, "/", { "x-forwarded-proto": "http" })["strict-transport-security"]).toBeUndefined();
    expect(effectiveHeaders(production, "/", { "x-forwarded-proto": "https" })["strict-transport-security"]).toBe(HSTS_VALUE);
    expect(effectiveHeaders(nextHeaderRules({ production: false }), "/", { "x-forwarded-proto": "https" })["strict-transport-security"]).toBeUndefined();
    expect(Number(HSTS_VALUE.match(/max-age=(\d+)/)?.[1])).toBeGreaterThanOrEqual(31536000);
    expect(HSTS_VALUE).not.toContain("preload");
  });

  it("T-10 · /api/** conserva no-store y /sw.js se revalida con una CSP propia más estricta", () => {
    const rules = nextHeaderRules({ production: true });
    for (const path of ["/api/inspecciones", "/api/inspecciones/inspection-001"]) {
      expect(effectiveHeaders(rules, path)["cache-control"], path).toBe("no-store");
    }
    const worker = effectiveHeaders(rules, "/sw.js");
    expect(worker["cache-control"]).toBe("no-cache");
    expect(worker["content-security-policy"]).toBe(SERVICE_WORKER_CSP);
    expect(parseCsp(SERVICE_WORKER_CSP)["script-src"]).toEqual(["'self'"]);
    // Las páginas conservan el Cache-Control que decide Next.js (estáticas o dinámicas).
    expect(effectiveHeaders(rules, "/inspecciones")["cache-control"]).toBeUndefined();
  });

  it("next.config.mjs publica exactamente nextHeaderRules() y no anuncia X-Powered-By", async () => {
    const { default: config } = await import("../next.config.mjs");
    expect(config.poweredByHeader).toBe(false);
    const previous = process.env.NODE_ENV;
    try {
      vi.stubEnv("NODE_ENV", "production");
      expect(await config.headers()).toEqual(nextHeaderRules({ production: true }));
      vi.stubEnv("NODE_ENV", "development");
      expect(await config.headers()).toEqual(nextHeaderRules({ production: false }));
    } finally {
      vi.unstubAllEnvs();
      expect(process.env.NODE_ENV).toBe(previous);
    }
  });
});

/** Arma una muestra en tiempo de ejecución para que el archivo no contenga la credencial literal. */
const sample = (...parts: string[]) => parts.join("");
const base64url = (text: string) => Buffer.from(text, "utf8").toString("base64url");

/** Una muestra por regla del escáner. */
const SAMPLES: Array<[rule: string, text: string]> = [
  ["aws-access-key-id", sample("AKIA", "Q2RZ7WN3KXPLM4BT")],
  ["google-api-key", sample("AIza", "SyB9fK2mQ7rT4vW8yZ1aC3eG5iL7nP9sU0w")],
  ["azure-storage-key", sample("AccountName=sintetica;Account", "Key=", "Zq8wX3kLm2".repeat(5), "==")],
  ["github-token", sample("gh", "p_", "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8")],
  ["npm-token", sample("np", "m_", "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8")],
  ["slack-token", sample("xo", "xb-", "123456789012-abcdefABCDEF")],
  ["stripe-secret-key", sample("sk", "_live_", "4eC39HqLyjWDarjtT1zdp7dc")],
  ["sk-api-key", sample("sk", "-proj-", "Ab3dEf6hIj9kLm2nOp5qRs8tUv1wXy4z")],
  ["supabase-secret-key", sample("sb", "_secret_", "N7xQ2mR9tY4uI8oP3aS6dF1g")],
  ["twilio-api-key", sample("S", "K", "0123456789abcdef".repeat(2))],
  ["private-key", sample("-----BEGIN ", "RSA PRIVATE", " KEY-----\n", "MIIBOgIBAAJBAKj34GkxFhD90vcNLYLInFEX6Ppy1tPf9Cnzj4p4WGeKLs1Pt8Qu\n")],
  ["jwt", [base64url('{"alg":"HS256","typ":"JWT"}'), base64url('{"sub":"tecnica-sintetica","iat":1761955200}'), "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"].join(".")],
  ["credential-in-url", sample("postgres://admin", ":", "Zq8wX3kLm2", "@db.interno:5432/inspecciones")],
  ["suspicious-assignment", sample("const db", "Password", ' = "', "Tr0ub4dor&3x", '";')],
  ["env-assignment", sample("export STRIPE_", "API_KEY", "=", "Zq8wX3kLm2Pq7")],
  ["sensitive-public-env", sample("process.env.NEXT_PUBLIC_", "SUPABASE_SERVICE_ROLE", "_KEY")],
];

/** Archivos de texto del repositorio, sin node_modules, artefactos generados ni el lockfile. */
function repositoryTextFiles(): string[] {
  const skipDirs = new Set(["node_modules", ".git", ".next", "coverage", "test-results", "playwright-report", "blob-report", "reports"]);
  const textFile = /\.(?:[cm]?[jt]sx?|json|md|ya?ml|txt|css|webmanifest|sh|mjs)$|^(?:Makefile|\.gitignore|\.nvmrc)$/;
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) walk(path);
      } else if (textFile.test(entry.name) && entry.name !== "package-lock.json") {
        files.push(path);
      }
    }
  };
  walk(ROOT);
  return files;
}

describe("Semana 9 · Carlos · credenciales (T-08)", () => {
  it.each(SAMPLES)("T-08 · detecta %s", (rule, text) => {
    expect(scanForSecrets(text).map((finding) => finding.rule)).toContain(rule);
  });

  it("T-08 · cada regla del escáner tiene su muestra en esta prueba", () => {
    expect(SAMPLES.map(([rule]) => rule).sort()).toEqual(SECRET_RULES.map((rule) => rule.id).sort());
  });

  it("T-08 · el hallazgo indica línea y columna, pero nunca el valor completo", () => {
    const value = sample("AKIA", "Q2RZ7WN3KXPLM4BT");
    const text = ["# configuración sintética", "region = mx-central-1", `  aws_access_key_id = ${value}`].join("\n");
    const findings = scanForSecrets(text);
    expect(findings).toEqual([expect.objectContaining({ rule: "aws-access-key-id", line: 3, column: 23 })]);
    expect(findings[0].redacted).toBe(`${value.slice(0, 4)}… (20 caracteres)`);
    expect(JSON.stringify(findings)).not.toContain(value);
  });

  it("T-08 · sin falsos positivos con código, marcadores y casi-credenciales", () => {
    const benign = [
      'const secret = "VALOR-SINTETICO-NO-ECO";', // tests/security.spec.ts, bloque 1
      "type Credenciales = { password: string; token?: string };",
      'const apiKey = process.env.API_KEY ?? "";',
      "postgres://user:password@localhost:5432/inspecciones",
      "https://example.test@sitio-externo.example/phishing",
      'tokenUrl: "https://oauth2.googleapis.com/token"',
      'aria-label="Contraseña" type="password"',
      "Authorization: Bearer ${token}",
      'password: "correcthorsebatterystaple"', // sin dígitos: límite documentado de la regla genérica
      'integrity: "sha512-Z9n2Gmq8zW1kX1cZr7x9KfP4Z2vQ8Yw2q5dN3w5L7n4bJ8sQ0uY1xR6eT3aC9vB2nM5kL8pO1iU4yT7rE0wQ3=="',
      "commit e13ee05f00c76b0a1b2c3d4e5f60718293a4b5c6 · id 9b2f0f8e-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
      "js-tokens css-tokenizer secretos tokens contraseñas",
      buildCsp(),
      sample("AKIA", "Q2RZ7WN3KXPLM4B"), // 15 caracteres tras el prefijo
      sample("AIza", "SyB9fK2mQ7rT4vW8yZ1aC3eG5iL7nP9sU0wXY"), // más largo que una clave real
      sample("eyJhbGciOiJIUzI1NiJ9", ".", "eyJzdWIiOiJ4In0"), // solo dos segmentos
      sample("process.env.NEXT_PUBLIC_", "SUPABASE_ANON_KEY"), // pública por diseño
      sample("export DB_", "PASSWORD", "=", "${DB_PASSWORD}"),
      sample("sk", "-proyecto-sin-digitos-solo-letras-largas"),
    ];
    for (const text of benign) {
      expect(scanForSecrets(text), text).toEqual([]);
    }
  });

  it("T-08 · sin falsos positivos en el propio repositorio (código, pruebas, documentación y workflows)", () => {
    const files = repositoryTextFiles();
    expect(files.length).toBeGreaterThan(50);
    const findings = files.flatMap((file) =>
      scanForSecrets(readFileSync(file, "utf8")).map((finding) => `${relative(ROOT, file)}:${finding.line} ${finding.rule}`),
    );
    expect(findings).toEqual([]);
  });

  it("T-08 · nombres de archivo que no deben versionarse; .env.example sí se permite", () => {
    for (const path of [".env", ".env.local", ".env.production", "config/.env.development", "llave.pem", "certs\\servidor.key", "id_rsa", "id_ed25519", "credentials.json", "gcp.credentials.json", "service-account-pwa.json", "gha-creds-123.json", "firma.p12"]) {
      expect(isSensitiveFileName(path), path).toBe(true);
    }
    for (const path of [".env.example", "docs/environment.md", "src/lib/security/secrets.ts", "id_rsa.pub", "public/manifest.webmanifest", "keys.ts", "tests/security.spec.ts"]) {
      expect(isSensitiveFileName(path), path).toBe(false);
    }
  });

  it("T-08 · .gitignore excluye .env*, llaves y credenciales, y conserva .env.example", () => {
    const ignored = readFileSync(resolve(ROOT, ".gitignore"), "utf8").split(/\r?\n/).map((line) => line.trim());
    for (const pattern of [".env*", "!.env.example", "*.pem", "*.key", "credentials.json", "service-account*.json"]) {
      expect(ignored, pattern).toContain(pattern);
    }
  });

  it("T-08 · src/ solo lee NODE_ENV del entorno: ninguna variable (y ninguna NEXT_PUBLIC_*) llega al bundle", () => {
    const sources = repositoryTextFiles().filter((file) => relative(ROOT, file).split(/[\\/]/)[0] === "src");
    const variables = new Set<string>();
    for (const file of sources) {
      for (const match of readFileSync(file, "utf8").matchAll(/process\.env\.([A-Z0-9_]+)|process\.env\[["']([A-Z0-9_]+)["']\]/g)) {
        variables.add(match[1] ?? match[2]);
      }
    }
    // Una variable nueva obliga a revisar si es secreta y si debe vivir solo en el servidor.
    expect([...variables]).toEqual(["NODE_ENV"]);
  });
});

describe("Semana 9 · Carlos · service worker sin cachés sensibles ni aperturas externas (T-07, T-10)", () => {
  it("T-10 · /api/** no se intercepta ni se responde desde caché, con red ni sin red", async () => {
    const network = createFakeNetwork();
    network.respond("/api/inspecciones", () => Response.json({ data: [] }, { headers: { "Cache-Control": "no-store" } }));
    const harness = createServiceWorkerHarness(network.fetch);
    await harness.install();
    // Aunque existiera una copia vieja de la API en la caché, el worker no debe usarla.
    const cache = await harness.caches.open(harness.read<string>("CACHE_VERSION"));
    await cache.put("/api/inspecciones", new Response("copia vieja de la API"));
    network.fetch.mockClear();

    for (const offline of [false, true]) {
      if (offline) network.goOffline();
      for (const build of [navigationRequest, assetRequest]) {
        expect(await harness.fetch(build("/api/inspecciones")), `GET /api ${offline ? "sin" : "con"} red`).toBeUndefined();
        expect(await harness.fetch(build("/api/inspecciones/inspection-001?simular=error"))).toBeUndefined();
      }
    }
    expect(network.fetch).not.toHaveBeenCalled(); // el worker ni siquiera la pide: la petición sigue al servidor
  });

  it.each(["no-store", "NO-STORE", "private, no-store, max-age=0", "no-cache, no-store, must-revalidate", "max-age=60,no-store"])(
    "T-10 · una respuesta con Cache-Control «%s» nunca se guarda ni se sirve sin red",
    async (cacheControl) => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const network = createFakeNetwork();
      network.respond("/offline", () => new Response("página sin conexión"));
      network.respond("/inspecciones/inspection-001", () => new Response("detalle sensible", { headers: { "Cache-Control": cacheControl } }));
      const harness = createServiceWorkerHarness(network.fetch);
      await harness.install();

      const online = await harness.fetch(navigationRequest("/inspecciones/inspection-001"));
      expect(await online?.text()).toBe("detalle sensible");
      const cache = await harness.caches.open(harness.read<string>("CACHE_VERSION"));
      expect(await cache.match("/inspecciones/inspection-001")).toBeUndefined();

      network.goOffline();
      const offline = await harness.fetch(navigationRequest("/inspecciones/inspection-001"));
      expect(await offline?.text()).toBe("página sin conexión");
    },
  );

  it("T-10 · defensa en capas: una ruta de API escrita con otra codificación tampoco queda en caché", async () => {
    // `/%61pi/...` no empieza con "/api/" para el worker; si el servidor la resolviera como la API,
    // su respuesta no-store sigue impidiendo que se guarde.
    const network = createFakeNetwork();
    network.respond("/%61pi/inspecciones", () => Response.json({ data: ["sintético"] }, { headers: { "Cache-Control": "no-store" } }));
    const harness = createServiceWorkerHarness(network.fetch);
    await harness.install();

    await harness.fetch(navigationRequest("/%61pi/inspecciones"));

    const cache = await harness.caches.open(harness.read<string>("CACHE_VERSION"));
    expect(await cache.match("/%61pi/inspecciones")).toBeUndefined();
  });

  const HOSTILE_URLS = [
    "https://sitio-externo.example/phishing",
    "http://example.test/inspecciones", // mismo host con otro esquema: otro origen
    "//sitio-externo.example/ruta",
    "\\\\sitio-externo.example\\ruta",
    "/\\sitio-externo.example",
    "https://example.test@sitio-externo.example/",
    " https://sitio-externo.example",
    "javascript:alert(1)",
    "data:text/html,hola",
  ];

  it.each(HOSTILE_URLS)("T-07 · un push con url «%s» abre la ruta propia por defecto, nunca otro sitio", async (url) => {
    const harness = createServiceWorkerHarness(createFakeNetwork().fetch);

    await harness.push(pushData(JSON.stringify({ title: "Aviso sintético", url })));
    const options = harness.showNotification.mock.calls.at(-1)?.[1] as { data: { url: string } };
    expect(options.data.url).toBe("/inspecciones");

    // Clic sobre el aviso que mostró el worker y sobre uno con datos externos creado por otra vía.
    for (const data of [options.data, { url }]) {
      await harness.notificationClick({ data, close: vi.fn() });
      expect(harness.openWindow).toHaveBeenLastCalledWith(`${ORIGIN}/inspecciones`);
    }
    for (const [opened] of harness.openWindow.mock.calls) {
      expect(new URL(opened).origin).toBe(ORIGIN);
    }
  });

  it("T-07 · control: una ruta propia con consulta se conserva al abrir el aviso", async () => {
    const harness = createServiceWorkerHarness(createFakeNetwork().fetch);
    await harness.push(pushData(JSON.stringify({ url: "/inspecciones/inspection-002?vista=detalle" })));
    const options = harness.showNotification.mock.calls.at(-1)?.[1] as { data: { url: string } };
    await harness.notificationClick({ data: options.data, close: vi.fn() });
    expect(harness.openWindow).toHaveBeenLastCalledWith(`${ORIGIN}/inspecciones/inspection-002?vista=detalle`);
  });
});
