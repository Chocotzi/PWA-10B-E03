// @vitest-environment jsdom
//
// Semana 9 · bloque 3 (Cleber): privacidad aplicada con IndexedDB simulada (`fake-indexeddb`).
// Se guarda sin red, se borra y se comprueba que no queda nada, ni siquiera tras "recargar".

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InspectionCaptureClient } from "../../src/components/inspection-capture-client";
import { PrivacyPanel } from "../../src/components/privacy-panel";
import { inspections } from "../../src/lib/data/inspections";
import { purgeLocalData } from "../../src/lib/security";
import { openMutationStorage } from "../../src/lib/storage/schema";
import { createSyncQueue, type SyncTransport } from "../../src/lib/sync/queue";

let idb: IDBFactory;

beforeEach(() => {
  idb = new IDBFactory();
  vi.stubGlobal("indexedDB", idb);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Semana 9 · Cleber · borrado de datos locales", () => {
  it("T-12 · guarda sin red, borra y no queda nada, tampoco al reabrir la base", async () => {
    const offline: SyncTransport = { send: vi.fn(async () => { throw new TypeError("Failed to fetch"); }) };
    const storage = await openMutationStorage(idb);
    const queue = createSyncQueue(storage, offline);
    await queue.enqueue({ ...inspections[0], id: "synthetic-priv-1" }, null);
    await queue.enqueue({ ...inspections[1], id: "synthetic-priv-2" }, null);
    expect(await storage.list()).toHaveLength(2);

    expect(await purgeLocalData(storage)).toBe(2);
    expect(await storage.list()).toEqual([]);
    storage.close();

    const reopened = await openMutationStorage(idb);
    expect(await reopened.list()).toEqual([]);
    reopened.close();
  });

  it("T-12 · después de borrar no se reenvía nada al servidor", async () => {
    const transport: SyncTransport = { send: vi.fn(async () => ({ kind: "applied" as const, revision: "rev-x" })) };
    const storage = await openMutationStorage(idb);
    const queue = createSyncQueue(storage, transport);
    await queue.enqueue({ ...inspections[0], id: "synthetic-priv-3" }, null);
    await purgeLocalData(storage);
    expect(await queue.flush()).toEqual({ sent: 0, conflicts: 0, deferred: 0 });
    expect(transport.send).not.toHaveBeenCalled();
    storage.close();
  });

  it("T-12 · el panel pide confirmación, permite cancelar y anuncia el resultado con aria-live", async () => {
    const onPurge = vi.fn(async () => 2);
    render(createElement(PrivacyPanel, { onPurge, localCount: 2 }));

    expect(screen.getByRole("heading", { name: "Aviso de privacidad (resumen)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Borrar datos locales" }));
    expect(onPurge).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "Confirmar borrado de datos locales" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onPurge).not.toHaveBeenCalled();
    expect(screen.queryByRole("group", { name: "Confirmar borrado de datos locales" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Borrar datos locales" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));
    const status = screen.getByTestId("privacy-status");
    await waitFor(() => expect(status.textContent).toContain("Se borraron 2 inspecciones"));
    expect(onPurge).toHaveBeenCalledTimes(1);
    expect(status.getAttribute("aria-live")).toBe("polite");
  });

  it("T-12 · si el borrado falla lo dice y no afirma que se borró", async () => {
    render(createElement(PrivacyPanel, { onPurge: async () => { throw new Error("IndexedDB bloqueada"); }, localCount: 1 }));
    fireEvent.click(screen.getByRole("button", { name: "Borrar datos locales" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));
    const status = screen.getByTestId("privacy-status");
    await waitFor(() => expect(status.textContent).toContain("No se pudieron borrar"));
    expect(status.textContent).not.toContain("IndexedDB bloqueada");
  });

  it("T-12 · desde la pantalla de captura: guarda sin red, borra y la base queda vacía", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch (sin red simulada)"); }));
    render(createElement(InspectionCaptureClient));
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar sin conexión" })).toBeTruthy());
    await screen.findByText("Captura local lista.", undefined, { timeout: 3000 }).catch(() => undefined);

    fireEvent.change(screen.getByLabelText("Laboratorio sintético"), { target: { value: "Laboratorio de Privacidad" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar sin conexión" }));
    await waitFor(() => expect(screen.getByText(/· 1 pendientes · 0 conflictos/)).toBeTruthy());

    const before = await openMutationStorage(idb);
    expect(await before.list()).toHaveLength(1);
    before.close();

    fireEvent.click(screen.getByRole("button", { name: "Borrar datos locales" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));
    await waitFor(() => expect(screen.getByTestId("privacy-status").textContent).toContain("Se borró 1 inspección"));
    await waitFor(() => expect(screen.getByText(/· 0 pendientes · 0 conflictos/)).toBeTruthy());

    const after = await openMutationStorage(idb);
    expect(await after.list()).toEqual([]);
    after.close();
  });
});
