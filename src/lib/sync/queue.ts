import type { Inspection } from "../data/inspections";
import type { MutationStorage, PendingMutation } from "../storage/schema";
import { decideConflict } from "./conflict-policy";

export type SyncResponse =
  | { kind: "applied"; revision: string }
  | { kind: "conflict"; serverRevision: string | null };

export interface SyncTransport {
  /** Must apply idempotently by mutation.id and compare baseRevision atomically. */
  send(mutation: PendingMutation): Promise<SyncResponse>;
}

export type FlushResult = { sent: number; conflicts: number; deferred: number };

export function createSyncQueue(storage: MutationStorage, transport: SyncTransport) {
  let activeFlush: Promise<FlushResult> | undefined;

  async function enqueue(inspection: Inspection, baseRevision: string | null, id: string = crypto.randomUUID()): Promise<PendingMutation> {
    if (!id || !inspection.id) throw new Error("La mutación y la inspección requieren identificador");
    const mutation: PendingMutation = {
      id,
      inspection: structuredClone(inspection),
      baseRevision,
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    await storage.add(mutation);
    return mutation;
  }

  async function flushOnce(): Promise<FlushResult> {
    const mutations = (await storage.list())
      .filter((item) => item.status === "pending")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const result: FlushResult = { sent: 0, conflicts: 0, deferred: 0 };

    for (let index = 0; index < mutations.length; index++) {
      const mutation = mutations[index];
      let response: SyncResponse;
      try {
        response = await transport.send(mutation);
      } catch {
        // The durable pending record is the retry mechanism. Preserve FIFO order.
        result.deferred = mutations.length - index;
        break;
      }

      if (response.kind === "conflict") {
        if (decideConflict(mutation.baseRevision, response.serverRevision) !== "conflict") {
          result.deferred = mutations.length - index;
          break;
        }
        await storage.put({ ...mutation, status: "conflict", serverRevision: response.serverRevision });
        result.conflicts++;
      } else {
        if (!response.revision) throw new Error("El servidor no devolvió revisión");
        await storage.delete(mutation.id);
        result.sent++;
      }
    }
    return result;
  }

  return {
    enqueue,
    list: () => storage.list(),
    pendingCount: async () => (await storage.list()).filter((item) => item.status === "pending").length,
    /** Concurrent calls in one tab share the same drain. Across tabs the server idempotency key protects writes. */
    flush: () => {
      if (!activeFlush) {
        activeFlush = flushOnce().finally(() => { activeFlush = undefined; });
      }
      return activeFlush;
    },
  };
}
