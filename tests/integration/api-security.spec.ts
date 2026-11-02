import { describe, expect, it } from "vitest";
import { GET as listRoute, POST } from "../../src/app/api/inspecciones/route";
import { GET as detailRoute } from "../../src/app/api/inspecciones/[id]/route";
import { inspections } from "../../src/lib/data/inspections";
import { JPEG_DATA_URL_PREFIX, MAX_BODY_BYTES } from "../../src/lib/security";

// Semana 9 · bloque 1 (Benkis): el endpoint real rechaza entradas hostiles y conserva la
// idempotencia y los conflictos de la Semana 5.

const URL_BASE = "http://localhost/api/inspecciones";

function body(id: string, inspectionId: string, baseRevision: string | null, inspection: Record<string, unknown> = {}) {
  return {
    id, baseRevision, createdAt: "2026-10-04T00:00:00.000Z", status: "pending",
    inspection: { ...inspections[0], id: inspectionId, ...inspection },
  };
}

function post(payload: unknown, headers: Record<string, string> = { "Content-Type": "application/json" }) {
  return new Request(URL_BASE, {
    method: "POST", headers,
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

describe("Semana 9 · Benkis · API endurecida", () => {
  it("T-01 · una mutación válida sigue respondiendo 201 y su reenvío 200 con el mismo resultado", async () => {
    const first = await POST(post(body("sec-int-1", "synthetic-sec-int-1", null)));
    const payload = await first.json();
    const replay = await POST(post(body("sec-int-1", "synthetic-sec-int-1", null)));
    expect(first.status).toBe(201);
    expect(payload).toEqual({ kind: "applied", revision: "rev-sec-int-1" });
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(payload);
  });

  it("T-01 · conserva el conflicto 409 sin sobrescribir la revisión del servidor", async () => {
    const applied = await POST(post(body("sec-int-2", "synthetic-sec-int-2", null)));
    const revision = (await applied.json() as { revision: string }).revision;
    const conflict = await POST(post(body("sec-int-3", "synthetic-sec-int-2", null)));
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ kind: "conflict", serverRevision: revision });
    const correct = await POST(post(body("sec-int-4", "synthetic-sec-int-2", revision)));
    expect(correct.status).toBe(201);
  });

  it("T-03 · responde 400 por campo y no devuelve el valor recibido", async () => {
    const marker = "VALOR-SINTETICO-NO-ECO";
    const response = await POST(post(body("sec-int-5", "synthetic-sec-int-5", null, { status: marker, findings: -4 })));
    const text = await response.text();
    expect(response.status).toBe(400);
    expect(text).not.toContain(marker);
    const payload = JSON.parse(text) as { code: string; issues: { field: string; code: string }[] };
    expect(payload.code).toBe("invalid_mutation");
    expect(payload.issues.map((issue) => issue.field)).toEqual(expect.arrayContaining(["inspection.status", "inspection.findings"]));
  });

  it("T-01 · una mutación inválida no toca revisiones ni confirmaciones", async () => {
    const invalid = await POST(post(body("sec-int-6", "synthetic-sec-int-6", null, { findings: "muchos" })));
    expect(invalid.status).toBe(400);
    // Si la inválida hubiera dejado una revisión, esta base null ahora daría 409.
    const valid = await POST(post(body("sec-int-6", "synthetic-sec-int-6", null)));
    expect(valid.status).toBe(201);
  });

  it("T-01 · rechaza __proto__ y claves extra sin contaminar el prototipo", async () => {
    const payload = '{"id":"sec-int-7","baseRevision":null,"createdAt":"2026-10-04","status":"pending","__proto__":{"admin":true},"inspection":{}}';
    const response = await POST(post(payload));
    expect(response.status).toBe(400);
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
    const extra = await POST(post({ ...body("sec-int-8", "synthetic-sec-int-8", null), role: "admin" }));
    expect(extra.status).toBe(400);
  });

  it("T-04 · exige Content-Type JSON (415)", async () => {
    const text = await POST(post(JSON.stringify(body("sec-int-9", "synthetic-sec-int-9", null)), { "Content-Type": "text/plain" }));
    const none = await POST(new Request(URL_BASE, { method: "POST", body: new Uint8Array([123, 125]) }));
    expect(text.status).toBe(415);
    expect(none.status).toBe(415);
    expect(await text.json()).toMatchObject({ code: "unsupported_media_type" });
  });

  it("T-02 · corta cuerpos gigantes con 413, aun con Content-Length falso", async () => {
    const huge = JSON.stringify({ pad: "x".repeat(MAX_BODY_BYTES + 10) });
    const lying = await POST(post(huge, { "Content-Type": "application/json", "Content-Length": "20" }));
    const declared = await POST(post(huge, { "Content-Type": "application/json" }));
    expect(lying.status).toBe(413);
    expect(declared.status).toBe(413);
  });

  it("T-02 · rechaza una foto que no es JPEG o excede el tamaño", async () => {
    const photo = { mimeType: "image/jpeg", dataUrl: JPEG_DATA_URL_PREFIX, width: 640, height: 480, bytes: 0, source: "file", capturedAt: "2026-10-04T00:00:00.000Z" };
    const ok = await POST(post(body("sec-int-10", "synthetic-sec-int-10", null, { evidence: { photo } })));
    expect(ok.status).toBe(201);
    const svg = await POST(post(body("sec-int-11", "synthetic-sec-int-11", null, { evidence: { photo: { ...photo, dataUrl: "data:image/svg+xml;base64,AAAA" } } })));
    expect(svg.status).toBe(400);
  });

  it("T-04 · rechaza escrituras de otro origen (403) y acepta el mismo origen", async () => {
    const cross = await POST(post(body("sec-int-12", "synthetic-sec-int-12", null), { "Content-Type": "application/json", Origin: "https://evil.example" }));
    const site = await POST(post(body("sec-int-12", "synthetic-sec-int-12", null), { "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" }));
    const same = await POST(post(body("sec-int-12", "synthetic-sec-int-12", null), { "Content-Type": "application/json", Origin: "http://localhost", "Sec-Fetch-Site": "same-origin" }));
    expect(cross.status).toBe(403);
    expect(site.status).toBe(403);
    expect(same.status).toBe(201); // los rechazos no registraron nada
  });

  it("T-03 · los errores no filtran mensajes internos y no se cachean", async () => {
    const bad = await POST(post("{roto"));
    expect(bad.status).toBe(400);
    expect(bad.headers.get("cache-control")).toBe("no-store");
    expect(await bad.json()).toEqual({ error: "Solicitud inválida", code: "bad_request" });

    const list = await listRoute(new Request(`${URL_BASE}?simular=error`));
    const listBody = await list.text();
    expect(list.status).toBe(500);
    expect(listBody).not.toContain("Fallo simulado");

    const detail = await detailRoute(new Request(`${URL_BASE}/inspection-001?simular=error`), { params: Promise.resolve({ id: "inspection-001" }) });
    expect(detail.status).toBe(500);
    expect(await detail.text()).not.toContain("Fallo simulado");
  });

  it("T-03 · las lecturas válidas siguen funcionando", async () => {
    const list = await listRoute(new Request(URL_BASE));
    expect(list.status).toBe(200);
    const missing = await detailRoute(new Request(`${URL_BASE}/nope`), { params: Promise.resolve({ id: "nope" }) });
    expect(missing.status).toBe(404);
  });
});
