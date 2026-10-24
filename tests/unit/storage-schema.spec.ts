import { describe, it, expect } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { openMutationStorage, type PendingMutation } from "../../src/lib/storage/schema";
import { inspections } from "../../src/lib/data/inspections";

describe("Unit: MutationStorage Schema & IndexedDB Lifecycle", () => {
  it("rejects when IDBFactory is unavailable (SSR simulation)", async () => {
    // Pass null as factory to simulate environments where indexedDB is not defined
    // @ts-expect-error testing invalid parameter
    await expect(openMutationStorage(null)).rejects.toThrow("IndexedDB no está disponible");
  });

  it("initializes database and provides full CRUD on mutations", async () => {
    const factory = new IDBFactory();
    const storage = await openMutationStorage(factory);

    const mutation1: PendingMutation = {
      id: "mut-001",
      inspection: inspections[0],
      baseRevision: null,
      createdAt: "2026-10-24T12:00:00.000Z",
      status: "pending",
    };

    const mutation2: PendingMutation = {
      id: "mut-002",
      inspection: inspections[1],
      baseRevision: "rev-0",
      createdAt: "2026-10-24T12:05:00.000Z",
      status: "pending",
    };

    // 1. Add mutations
    await storage.add(mutation1);
    await storage.add(mutation2);

    // 2. Reject duplicate ID addition
    await expect(storage.add(mutation1)).rejects.toBeTruthy();

    // 3. List mutations
    const all = await storage.list();
    expect(all).toHaveLength(2);
    expect(all.map((m) => m.id)).toContain("mut-001");
    expect(all.map((m) => m.id)).toContain("mut-002");

    // 4. Update (put) mutation
    const updatedMutation: PendingMutation = {
      ...mutation1,
      status: "conflict",
      serverRevision: "rev-server-1",
    };
    await storage.put(updatedMutation);

    const afterPut = await storage.list();
    const found = afterPut.find((m) => m.id === "mut-001");
    expect(found?.status).toBe("conflict");
    expect(found?.serverRevision).toBe("rev-server-1");

    // 5. Delete mutation
    await storage.delete("mut-001");
    const afterDelete = await storage.list();
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0].id).toBe("mut-002");

    // 6. Close connection cleanly
    expect(() => storage.close()).not.toThrow();
  });
});
