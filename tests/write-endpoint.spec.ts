import { describe, expect, it } from "vitest";
import { POST } from "../src/app/api/inspecciones/route";
import { inspections } from "../src/lib/data/inspections";

function request(id: string, inspectionId: string, baseRevision: string | null) {
  return new Request("http://localhost/api/inspecciones", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, baseRevision, createdAt: "2026-10-04T00:00:00.000Z", status: "pending", inspection: { ...inspections[0], id: inspectionId } }),
  });
}

describe("endpoint de escritura sintético", () => {
  it("deduplica por mutación y conserva el resultado aplicado", async () => {
    const first = await POST(request("mutation-endpoint-1", "synthetic-endpoint-1", null));
    const firstPayload = await first.json();
    const duplicate = await POST(request("mutation-endpoint-1", "synthetic-endpoint-1", null));
    expect(first.status).toBe(201);
    expect(await duplicate.json()).toEqual(firstPayload);
  });

  it("rechaza una base desactualizada sin sobrescribir la revisión del servidor", async () => {
    const applied = await POST(request("mutation-endpoint-2", "synthetic-endpoint-2", null));
    const revision = (await applied.json() as { revision: string }).revision;
    const conflict = await POST(request("mutation-endpoint-3", "synthetic-endpoint-2", null));
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ kind: "conflict", serverRevision: revision });
  });
});
