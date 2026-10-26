import { describe, it, expect, vi } from "vitest";
import { createSyncQueue, type SyncTransport } from "../../src/lib/sync/queue";
import type { MutationStorage, PendingMutation } from "../../src/lib/storage/schema";
import { inspections } from "../../src/lib/data/inspections";

function createMemoryStorage(): MutationStorage {
  const map = new Map<string, PendingMutation>();
  return {
    add: async (mutation) => {
      if (map.has(mutation.id)) throw new Error("ID duplicado en almacenamiento");
      map.set(mutation.id, structuredClone(mutation));
    },
    put: async (mutation) => {
      map.set(mutation.id, structuredClone(mutation));
    },
    list: async () => [...map.values()].map((m) => structuredClone(m)),
    delete: async (id) => {
      map.delete(id);
    },
    close: () => {},
  };
}

describe("Unit: Sync Queue Rules & Idempotency", () => {
  describe("Regla de validación de encolado (enqueue)", () => {
    it("rechaza mutaciones con identificador de mutación o de inspección vacío", async () => {
      const storage = createMemoryStorage();
      const transport: SyncTransport = { send: vi.fn() };
      const queue = createSyncQueue(storage, transport);

      // Mutación con ID vacío
      await expect(
        // @ts-expect-error probando valor inválido
        queue.enqueue(inspections[0], null, "")
      ).rejects.toThrow("La mutación y la inspección requieren identificador");

      // Inspección sin ID
      await expect(
        // @ts-expect-error probando inspección con ID inválido
        queue.enqueue({ ...inspections[0], id: "" }, null, "mut-1")
      ).rejects.toThrow("La mutación y la inspección requieren identificador");
    });

    it("encola exitosamente con entradas válidas y estado 'pending'", async () => {
      const storage = createMemoryStorage();
      const transport: SyncTransport = { send: vi.fn() };
      const queue = createSyncQueue(storage, transport);

      const mutation = await queue.enqueue(inspections[0], "rev-0", "mut-valid-1");
      expect(mutation.id).toBe("mut-valid-1");
      expect(mutation.status).toBe("pending");
      expect(mutation.baseRevision).toBe("rev-0");
      expect(await queue.pendingCount()).toBe(1);
    });
  });

  describe("Regla de idempotencia y concurrencia de la cola (flush)", () => {
    it("comparte el mismo drenaje y no duplica envíos ante llamadas concurrentes simultáneas", async () => {
      const storage = createMemoryStorage();
      const sendMock = vi.fn().mockImplementation(async () => {
        // Simular retardo de red
        await new Promise((res) => setTimeout(res, 20));
        return { kind: "applied", revision: "rev-new" };
      });
      const queue = createSyncQueue(storage, { send: sendMock });

      await queue.enqueue(inspections[0], null, "mut-idemp-1");

      // Ejecutar dos flush simultáneos
      const [res1, res2] = await Promise.all([queue.flush(), queue.flush()]);

      // Ambos deben resolver exactamente el mismo resultado
      expect(res1).toEqual(res2);
      expect(res1.sent).toBe(1);

      // El transporte solo debió ser llamado UNA sola vez para esta mutación
      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(await queue.pendingCount()).toBe(0);
    });

    it("es idempotente ante flush repetido cuando la cola ya fue procesada", async () => {
      const storage = createMemoryStorage();
      const sendMock = vi.fn().mockResolvedValue({ kind: "applied", revision: "rev-new" });
      const queue = createSyncQueue(storage, { send: sendMock });

      await queue.enqueue(inspections[0], null, "mut-once");
      await queue.flush();
      expect(sendMock).toHaveBeenCalledTimes(1);

      // Segundo flush secuencial con la cola vacía
      const secondRes = await queue.flush();
      expect(secondRes.sent).toBe(0);
      expect(secondRes.deferred).toBe(0);
      expect(sendMock).toHaveBeenCalledTimes(1); // No vuelve a llamar al transporte
    });

    it("preserva la mutación y mantiene orden FIFO ante fallo de red", async () => {
      const storage = createMemoryStorage();
      const sendMock = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network connection failure"))
        .mockResolvedValueOnce({ kind: "applied", revision: "rev-recovered" });

      const queue = createSyncQueue(storage, { send: sendMock });
      await queue.enqueue(inspections[0], null, "mut-retry-1");

      // Primer flush: falla red, mutación debe diferirse y conservarse
      const firstResult = await queue.flush();
      expect(firstResult.deferred).toBe(1);
      expect(firstResult.sent).toBe(0);
      expect(await queue.pendingCount()).toBe(1);

      // Segundo flush: red recuperada, se completa
      const secondResult = await queue.flush();
      expect(secondResult.sent).toBe(1);
      expect(secondResult.deferred).toBe(0);
      expect(await queue.pendingCount()).toBe(0);
    });
  });
});
