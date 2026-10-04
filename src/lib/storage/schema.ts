import type { Inspection } from "../data/inspections";

export const SYNC_DB_NAME = "inspecciones-sync";
export const SYNC_DB_VERSION = 1;
export const MUTATIONS_STORE = "mutations";

export type MutationStatus = "pending" | "conflict";

export type PendingMutation = {
  id: string;
  inspection: Inspection;
  /** Revision observed before this edit; null means a new record. */
  baseRevision: string | null;
  createdAt: string;
  status: MutationStatus;
  serverRevision?: string | null;
};

export interface MutationStorage {
  add(mutation: PendingMutation): Promise<void>;
  put(mutation: PendingMutation): Promise<void>;
  list(): Promise<PendingMutation[]>;
  delete(id: string): Promise<void>;
  close(): void;
}

/** Browser-only storage. Opening it during SSR is an explicit error. */
export function openMutationStorage(factory: IDBFactory = globalThis.indexedDB): Promise<MutationStorage> {
  if (!factory) return Promise.reject(new Error("IndexedDB no está disponible"));

  return new Promise((resolve, reject) => {
    const request = factory.open(SYNC_DB_NAME, SYNC_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MUTATIONS_STORE)) {
        db.createObjectStore(MUTATIONS_STORE, { keyPath: "id" });
      }
    };
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir IndexedDB"));
    request.onblocked = () => reject(new Error("Actualización de IndexedDB bloqueada por otra pestaña"));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();

      function run<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
        return new Promise((done, fail) => {
          let transaction: IDBTransaction;
          let operationRequest: IDBRequest<T>;
          try {
            transaction = db.transaction(MUTATIONS_STORE, mode);
            operationRequest = operation(transaction.objectStore(MUTATIONS_STORE));
          } catch (error) {
            fail(error);
            return;
          }
          transaction.oncomplete = () => done(operationRequest.result);
          transaction.onerror = () => fail(transaction.error ?? new Error("Error de IndexedDB"));
          transaction.onabort = () => fail(transaction.error ?? new Error("Transacción cancelada"));
        });
      }

      resolve({
        add: async (mutation) => { await run("readwrite", (store) => store.add(mutation)); },
        put: async (mutation) => { await run("readwrite", (store) => store.put(mutation)); },
        list: () => run("readonly", (store) => store.getAll()),
        delete: async (id) => { await run("readwrite", (store) => store.delete(id)); },
        close: () => db.close(),
      });
    };
  });
}
