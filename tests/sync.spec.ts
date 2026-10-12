import { describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { inspections } from "../src/lib/data/inspections";
import { decideConflict } from "../src/lib/sync/conflict-policy";
import { createSyncQueue, type SyncTransport } from "../src/lib/sync/queue";
import { openMutationStorage, type MutationStorage, type PendingMutation } from "../src/lib/storage/schema";

function memoryStorage(): MutationStorage {
  const records = new Map<string, PendingMutation>();
  return {
    add: async (record) => {
      if (records.has(record.id)) throw new Error("duplicate id");
      records.set(record.id, structuredClone(record));
    },
    put: async (record) => { records.set(record.id, structuredClone(record)); },
    list: async () => [...records.values()].map((record) => structuredClone(record)),
    delete: async (id) => { records.delete(id); },
    close: () => undefined,
  };
}

describe("política de conflictos", () => {
  it("solo permite escribir con la revisión de servidor observada", () => {
    expect(decideConflict(null, null)).toBe("apply");
    expect(decideConflict("rev-1", "rev-1")).toBe("apply");
    expect(decideConflict(null, "rev-1")).toBe("conflict");
    expect(decideConflict("rev-1", "rev-2")).toBe("conflict");
  });
});

describe("IndexedDB real simulado", () => {
  it("persiste la mutación al cerrar y reabrir la base, y rechaza ids repetidos", async () => {
    const factory = new IDBFactory();
    const first = await openMutationStorage(factory);
    const mutation: PendingMutation = {
      id: "synthetic-mutation-1", inspection: inspections[0], baseRevision: null,
      createdAt: "2026-10-04T00:00:00.000Z", status: "pending",
    };
    await first.add(mutation);
    await expect(first.add(mutation)).rejects.toBeTruthy();
    first.close();

    const reopened = await openMutationStorage(factory);
    expect(await reopened.list()).toEqual([mutation]);
    await reopened.put({ ...mutation, status: "conflict", serverRevision: "rev-2" });
    expect((await reopened.list())[0].status).toBe("conflict");
    await reopened.delete(mutation.id);
    expect(await reopened.list()).toEqual([]);
    reopened.close();
  });
});

describe("cola de sincronización", () => {
  it("confirma solo después de respuesta y conserva la copia ante una caída de red", async () => {
    const storage = memoryStorage();
    const send = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ kind: "applied", revision: "rev-1" });
    const queue = createSyncQueue(storage, { send });
    await queue.enqueue(inspections[0], null, "mutation-1");
    expect(await queue.flush()).toEqual({ sent: 0, conflicts: 0, deferred: 1 });
    expect(await queue.pendingCount()).toBe(1);
    expect(await queue.flush()).toEqual({ sent: 1, conflicts: 0, deferred: 0 });
    expect(await queue.pendingCount()).toBe(0);
    expect(send.mock.calls[0][0].id).toBe(send.mock.calls[1][0].id);
  });

  it("mantiene FIFO, detiene la cola ante error y no envía dos veces por llamadas simultáneas", async () => {
    const storage = memoryStorage();
    const send = vi.fn().mockResolvedValue({ kind: "applied", revision: "rev-1" });
    const queue = createSyncQueue(storage, { send });
    await queue.enqueue(inspections[0], null, "mutation-1");
    await queue.enqueue(inspections[1], null, "mutation-2");
    const [first, second] = await Promise.all([queue.flush(), queue.flush()]);
    expect(first).toEqual(second);
    expect(send.mock.calls.map(([mutation]) => mutation.id)).toEqual(["mutation-1", "mutation-2"]);
  });

  it("retiene los conflictos para revisión y no los reintenta automáticamente", async () => {
    const storage = memoryStorage();
    const send = vi.fn().mockResolvedValue({ kind: "conflict", serverRevision: "rev-2" });
    const queue = createSyncQueue(storage, { send });
    await queue.enqueue(inspections[1], "rev-1", "mutation-1");
    expect(await queue.flush()).toEqual({ sent: 0, conflicts: 1, deferred: 0 });
    expect(await queue.list()).toMatchObject([{ status: "conflict", serverRevision: "rev-2" }]);
    expect(await queue.pendingCount()).toBe(0);
    await queue.flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("rechaza una respuesta de conflicto contradictoria y conserva el pendiente", async () => {
    const storage = memoryStorage();
    const transport: SyncTransport = { send: async () => ({ kind: "conflict", serverRevision: null }) };
    const queue = createSyncQueue(storage, transport);
    await queue.enqueue(inspections[0], null, "mutation-1");
    expect(await queue.flush()).toEqual({ sent: 0, conflicts: 0, deferred: 1 });
    expect((await queue.list())[0].status).toBe("pending");
  });
});
