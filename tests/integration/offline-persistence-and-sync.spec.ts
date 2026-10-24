import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { openMutationStorage, type PendingMutation } from "../../src/lib/storage/schema";
import { createSyncQueue, type SyncTransport } from "../../src/lib/sync/queue";
import { POST as handlePostInspection } from "../../src/app/api/inspecciones/route";
import { inspections, type Inspection } from "../../src/lib/data/inspections";

describe("Integration: Offline Persistence & Duplicate-Free Sync", () => {
  let factory: IDBFactory;

  beforeEach(() => {
    factory = new IDBFactory();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persiste la inspección en almacenamiento local cuando se guarda sin conexión", async () => {
    const storage = await openMutationStorage(factory);

    const syntheticInspection: Inspection = {
      id: "synthetic-offline-001",
      location: "Laboratorio de Cómputo 1",
      date: "2026-10-24",
      inspector: "Técnico Inspector",
      status: "ok",
      statusLabel: "Sin incidencias",
      findings: 0,
      summary: "Inspección guardada durante modo desconectado.",
    };

    const mutation: PendingMutation = {
      id: "mut-offline-001",
      inspection: syntheticInspection,
      baseRevision: null,
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    // 1. Guardar mutación offline
    await storage.add(mutation);

    // 2. Simular recarga cerrando la conexión y reabriendo IndexedDB
    storage.close();

    const reopenedStorage = await openMutationStorage(factory);
    const storedItems = await reopenedStorage.list();

    expect(storedItems).toHaveLength(1);
    expect(storedItems[0].id).toBe("mut-offline-001");
    expect(storedItems[0].status).toBe("pending");
    expect(storedItems[0].inspection.location).toBe("Laboratorio de Cómputo 1");
    reopenedStorage.close();
  });

  it("reintentar la sincronización de la misma operación contra el endpoint no crea un duplicado (idempotencia)", async () => {
    const testMutation: PendingMutation = {
      id: "idempotency-key-uuid-999",
      inspection: {
        id: "inspection-target-999",
        location: "Laboratorio de Robótica",
        date: "2026-10-24",
        inspector: "Auditor de Redes",
        status: "attention",
        statusLabel: "Requiere atención",
        findings: 1,
        summary: "Prueba de deduplicación e idempotencia.",
      },
      baseRevision: null,
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    // Crear mock Request para POST /api/inspecciones
    const req1 = new Request("http://localhost:3000/api/inspecciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testMutation),
    });

    const res1 = await handlePostInspection(req1);
    const body1 = await res1.json();

    expect(res1.status).toBe(201);
    expect(body1.kind).toBe("applied");
    expect(body1.revision).toBe("rev-idempotency-key-uuid-999");

    // Segundo envío idéntico (simulando reintento por pérdida de paquete ACK)
    const req2 = new Request("http://localhost:3000/api/inspecciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testMutation),
    });

    const res2 = await handlePostInspection(req2);
    const body2 = await res2.json();

    // Debe responder el mismo acuse previo (idempotencia) sin crear duplicado ni conflicto 409
    expect(res2.status).toBe(200);
    expect(body2.kind).toBe("applied");
    expect(body2.revision).toBe(body1.revision);
  });

  it("controla las respuestas remotas con fixtures de conflicto y fallo de red", async () => {
    const storage = await openMutationStorage(factory);

    // Fixture de conflicto: el servidor responde que la revisión actual es rev-server-99
    const conflictTransport: SyncTransport = {
      send: async () => ({ kind: "conflict", serverRevision: "rev-server-99" }),
    };

    const queue = createSyncQueue(storage, conflictTransport);
    await queue.enqueue(inspections[0], "rev-client-old", "mutation-conflict-1");

    const flushResult = await queue.flush();
    expect(flushResult.conflicts).toBe(1);
    expect(flushResult.sent).toBe(0);

    // El estado en IndexedDB debe ser retenido como 'conflict'
    const stored = await storage.list();
    expect(stored[0].status).toBe("conflict");
    expect(stored[0].serverRevision).toBe("rev-server-99");

    storage.close();
  });

  it("retiene la mutación como pending ante una caída de red simulada y la envía al reintentar", async () => {
    const storage = await openMutationStorage(factory);

    // Fixture de caída de red: el primer intento de envío falla (p. ej. fetch rechazado /
    // conexión perdida); el segundo intento (tras "recuperar señal") se aplica con éxito.
    let attempts = 0;
    const flakyTransport: SyncTransport = {
      send: async (mutation) => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("Network request failed (simulated offline)");
        }
        return { kind: "applied", revision: `rev-${mutation.id}` };
      },
    };

    const queue = createSyncQueue(storage, flakyTransport);
    await queue.enqueue(inspections[1], null, "mutation-network-failure-1");

    // Primer intento: la "red" falla. La mutación debe quedar retenida como pending,
    // nunca perdida ni marcada como conflicto.
    const firstFlush = await queue.flush();
    expect(firstFlush).toEqual({ sent: 0, conflicts: 0, deferred: 1 });

    const afterFailure = await storage.list();
    expect(afterFailure).toHaveLength(1);
    expect(afterFailure[0].status).toBe("pending");
    expect(afterFailure[0].id).toBe("mutation-network-failure-1");

    // Segundo intento: la "red" se recupera y el servidor aplica la mutación.
    const secondFlush = await queue.flush();
    expect(secondFlush).toEqual({ sent: 1, conflicts: 0, deferred: 0 });

    const afterRetry = await storage.list();
    expect(afterRetry).toHaveLength(0);

    storage.close();
  });
});
