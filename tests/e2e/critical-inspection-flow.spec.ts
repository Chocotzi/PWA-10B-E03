// @vitest-environment jsdom
//
// Semana 8 — E2E del flujo crítico desde la interfaz (capa rápida, sin navegador real).
//
// Se renderiza la pantalla real de captura (`InspectionCaptureClient` con sus componentes de evidencia
// y avisos) y se maneja solo con eventos de usuario. Lo único simulado es el entorno del navegador:
//   - IndexedDB: `fake-indexeddb`; la misma base sobrevive a la "recarga" (desmontar y volver a montar),
//     igual que en el navegador, mientras que todo el estado de React se pierde.
//   - Red: `fetch` llega al handler REAL de `POST /api/inspecciones` en el mismo proceso. Cada caso
//     carga un módulo nuevo del handler, así que el "servidor" empieza vacío. Sin red, `fetch` rechaza.
//   - Dispositivo: `navigator.mediaDevices`, `navigator.geolocation` y `navigator.permissions` se
//     definen por caso para negar el permiso; si no se definen, la capacidad falta (jsdom no las trae).
// La versión en Chromium real, con servidor `next start`, está en `critical-inspection-flow.pw.ts`.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InspectionCaptureClient } from "../../src/components/inspection-capture-client";
import { CAMERA_MESSAGES, PHOTO_MESSAGES } from "../../src/lib/device/camera";
import { LOCATION_MESSAGES } from "../../src/lib/device/geolocation";
import { openMutationStorage, type PendingMutation } from "../../src/lib/storage/schema";

// ---------------------------------------------------------------------------------------------
// Entorno simulado
// ---------------------------------------------------------------------------------------------

type ServerCall = { status: number; kind: string; mutationId: string; inspectionId: string };

const restoreNavigator: Array<() => void> = [];

/** Define una propiedad de `navigator` solo para el caso actual. */
function defineNavigator(property: string, value: unknown) {
  const previous = Object.getOwnPropertyDescriptor(window.navigator, property);
  Object.defineProperty(window.navigator, property, { value, configurable: true, writable: true });
  restoreNavigator.push(() => {
    if (previous) Object.defineProperty(window.navigator, property, previous);
    else delete (window.navigator as unknown as Record<string, unknown>)[property];
  });
}

let idb: IDBFactory;
let server: Awaited<ReturnType<typeof startServer>>;

/** Handler real de la API con un registro de lo que recibió y respondió. */
async function startServer() {
  vi.resetModules(); // módulo nuevo: los mapas en memoria del handler empiezan vacíos
  const { POST } = await import("../../src/app/api/inspecciones/route");
  const calls: ServerCall[] = [];
  let networkUp = true;
  let dropNextResponse = false;

  const fetchStub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!networkUp) throw new TypeError("Failed to fetch (sin red simulada)");
    const url = new URL(String(input), window.location.origin);
    if (url.pathname !== "/api/inspecciones" || init?.method !== "POST") {
      throw new Error(`Solicitud no prevista en la prueba: ${init?.method ?? "GET"} ${url.pathname}`);
    }
    const response = await POST(new Request(url, init));
    const sent = JSON.parse(String(init.body)) as PendingMutation;
    const body = (await response.clone().json()) as { kind?: string };
    calls.push({ status: response.status, kind: body.kind ?? "error", mutationId: sent.id, inspectionId: sent.inspection.id });
    if (dropNextResponse) {
      // El servidor ya aplicó el cambio, pero la respuesta no llega al cliente (conexión cortada).
      dropNextResponse = false;
      throw new TypeError("Failed to fetch (respuesta perdida)");
    }
    return response;
  });
  vi.stubGlobal("fetch", fetchStub);

  return {
    calls,
    fetchStub,
    setNetwork(up: boolean) { networkUp = up; },
    loseNextResponse() { dropNextResponse = true; },
    /** Inspecciones distintas que el servidor registró (respuesta 201). */
    createdInspections: () => new Set(calls.filter((call) => call.status === 201).map((call) => call.inspectionId)),
    createdCount: (inspectionId: string) => calls.filter((call) => call.status === 201 && call.inspectionId === inspectionId).length,
  };
}

/** Cambia la conectividad como lo vería la página: `navigator.onLine`, red y evento de ventana. */
function setOnline(online: boolean, options: { dispatch?: boolean } = { dispatch: true }) {
  defineNavigator("onLine", online);
  server.setNetwork(online);
  if (options.dispatch) fireEvent(window, new Event(online ? "online" : "offline"));
}

function openApp() {
  return render(createElement(InspectionCaptureClient));
}

async function waitUntilReady() {
  await screen.findByText("Captura local lista.", undefined, { timeout: 3000 }).catch(() => undefined);
  await waitFor(() => expect(screen.getByRole("button", { name: "Guardar sin conexión" })).toBeTruthy());
}

function syncSummary() {
  return screen.getByText(/· \d+ pendientes · \d+ conflictos/).textContent ?? "";
}

function notice() {
  return screen.getByTestId("capture-notice").textContent ?? "";
}

function localItems() {
  const list = screen.queryByRole("list", { name: "Inspecciones locales pendientes y en conflicto" });
  return list ? within(list).getAllByRole("listitem").map((item) => item.textContent ?? "") : [];
}

async function storedMutations(): Promise<PendingMutation[]> {
  const storage = await openMutationStorage(idb);
  try {
    return await storage.list();
  } finally {
    storage.close();
  }
}

/** Llena el formulario con datos sintéticos y guarda. */
function fillAndSave(lab: string) {
  fireEvent.change(screen.getByLabelText("Laboratorio sintético"), { target: { value: lab } });
  fireEvent.change(screen.getByLabelText("Responsable sintético"), { target: { value: "Técnica sintética E2E" } });
  fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "attention" } });
  fireEvent.change(screen.getByLabelText("Hallazgos"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Resumen sintético"), { target: { value: "Registro sintético del flujo crítico E2E." } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar sin conexión" }));
}

beforeEach(async () => {
  idb = new IDBFactory();
  vi.stubGlobal("indexedDB", idb);
  server = await startServer();
});

afterEach(() => {
  cleanup();
  while (restoreNavigator.length > 0) restoreNavigator.pop()?.();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------------------------
// Flujo crítico
// ---------------------------------------------------------------------------------------------

describe("E2E (jsdom) · flujo crítico de captura offline", () => {
  it("crear → guardar sin conexión → recargar sin perderla → reconectar → una sola inspección sincronizada", async () => {
    const lab = "Laboratorio Sintético E2E-01";

    // Preparación: la página abre sin conexión.
    setOnline(false, { dispatch: false });
    let view = openApp();
    await waitUntilReady();
    expect(syncSummary()).toBe("Sin conexión · 0 pendientes · 0 conflictos");

    // Acción 1: crear y guardar sin conexión.
    fillAndSave(lab);
    await waitFor(() => expect(localItems()).toHaveLength(1));
    expect(notice()).toBe(`Inspección guardada. ${lab}: guardada sin conexión; se enviará al volver la red.`);
    expect(localItems()[0]).toContain(lab);
    expect(localItems()[0]).toContain("Pendiente de sincronizar");
    expect(syncSummary()).toBe("Sin conexión · 1 pendientes · 0 conflictos");
    expect(server.fetchStub).not.toHaveBeenCalled(); // sin red no se intenta enviar
    const [saved] = await storedMutations();
    expect(saved).toMatchObject({ status: "pending", baseRevision: null, inspection: { location: lab, status: "attention", findings: 2 } });

    // Acción 2: recargar (se desmonta la página y se vuelve a montar; solo queda IndexedDB).
    view.unmount();
    view = openApp();
    await waitUntilReady();
    await waitFor(() => expect(localItems()).toHaveLength(1));
    expect(localItems()[0]).toContain(lab);
    expect(syncSummary()).toBe("Sin conexión · 1 pendientes · 0 conflictos");

    // Acción 3: reconectar. El evento `online` llega dos veces seguidas (conexión intermitente): ambos
    // disparos comparten el mismo envío y el servidor no duplica nada. No se pulsa ningún botón.
    setOnline(true);
    fireEvent(window, new Event("online"));

    await waitFor(() => expect(notice()).toBe("Sincronización completada. 1 inspección enviada al servidor."));
    await waitFor(() => expect(localItems()).toHaveLength(0));
    expect(syncSummary()).toBe("Con conexión · 0 pendientes · 0 conflictos");

    // Resultado: una sola inspección sincronizada, la misma que se guardó, y cola local vacía.
    expect(server.calls).toHaveLength(1);
    expect(server.calls[0]).toMatchObject({ status: 201, kind: "applied", mutationId: saved.id, inspectionId: saved.inspection.id });
    expect(Array.from(server.createdInspections())).toEqual([saved.inspection.id]);
    expect(await storedMutations()).toEqual([]);

    // Un reintento posterior no envía nada: la cola ya está vacía.
    fireEvent.click(screen.getByRole("button", { name: "Reintentar sincronización" }));
    await waitFor(() => expect(notice()).toBe("Sincronización terminada."));
    expect(server.calls).toHaveLength(1);
  });

  it("si se pierde la respuesta del servidor, el reintento tras recargar no duplica la inspección", async () => {
    const lab = "Laboratorio Sintético E2E-02";
    setOnline(true, { dispatch: false });
    server.loseNextResponse(); // el primer envío se aplica en el servidor, pero el cliente no lo sabe

    let view = openApp();
    await waitUntilReady();
    fillAndSave(lab);

    await waitFor(() => expect(notice()).toBe("No se pudo sincronizar; la copia local sigue guardada."));
    expect(localItems()).toHaveLength(1);
    expect(localItems()[0]).toContain("Pendiente de sincronizar");
    const [pending] = await storedMutations();
    expect(server.calls).toEqual([{ status: 201, kind: "applied", mutationId: pending.id, inspectionId: pending.inspection.id }]);

    // Recarga: al montar, la página reintenta la misma operación (misma clave de idempotencia).
    view.unmount();
    view = openApp();
    await waitFor(() => expect(notice()).toBe("Sincronización completada. 1 inspección enviada al servidor."));
    await waitFor(() => expect(localItems()).toHaveLength(0));

    expect(server.calls).toHaveLength(2);
    expect(server.calls[1]).toMatchObject({ status: 200, kind: "applied", mutationId: pending.id });
    expect(server.createdCount(pending.inspection.id)).toBe(1); // reenvío reconocido, no un registro nuevo
    expect(await storedMutations()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Variante: capacidad de la Semana 6 negada o ausente
// ---------------------------------------------------------------------------------------------

describe("E2E (jsdom) · captura con capacidades del dispositivo negadas o ausentes", () => {
  it("con cámara y ubicación denegadas, la pantalla lo explica y la inspección se guarda y sincroniza sin evidencia", async () => {
    const lab = "Laboratorio Sintético E2E-03";
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException("Permission denied", "NotAllowedError"));
    const getCurrentPosition = vi.fn((_ok: PositionCallback, fail?: PositionErrorCallback | null) => {
      fail?.({ code: 1, message: "User denied Geolocation", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
    });
    const query = vi.fn(async () => ({ state: "prompt" }));
    defineNavigator("mediaDevices", { getUserMedia });
    defineNavigator("geolocation", { getCurrentPosition, watchPosition: vi.fn(), clearWatch: vi.fn() });
    defineNavigator("permissions", { query });

    setOnline(false, { dispatch: false });
    openApp();
    await waitUntilReady();
    // Al cargar solo se consultan estados; ningún permiso se pide sin un clic.
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(getCurrentPosition).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Abrir cámara" }));
    await waitFor(() => expect(screen.getByTestId("photo-status").textContent).toBe(CAMERA_MESSAGES.denied));
    expect(screen.getByText("La cámara está bloqueada para este sitio; «Elegir imagen» sigue disponible.")).toBeTruthy();
    expect(screen.getByLabelText("Elegir imagen")).toHaveProperty("disabled", false);

    fireEvent.click(screen.getByRole("button", { name: "Agregar ubicación aproximada" }));
    await waitFor(() => expect(screen.getByTestId("location-status").textContent).toBe(LOCATION_MESSAGES.denied));
    expect(screen.getByText("La ubicación está bloqueada para este sitio; puedes guardar sin ella.")).toBeTruthy();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);

    // La captura se completa: se guarda sin evidencia y se sincroniza una sola vez al volver la red.
    fillAndSave(lab);
    await waitFor(() => expect(localItems()).toEqual([`${lab} — Pendiente de sincronizar · sin evidencia`]));
    const [saved] = await storedMutations();
    expect(saved.inspection).not.toHaveProperty("evidence"); // no se inventan foto ni coordenadas

    setOnline(true);
    await waitFor(() => expect(notice()).toBe("Sincronización completada. 1 inspección enviada al servidor."));
    expect(server.calls).toEqual([{ status: 201, kind: "applied", mutationId: saved.id, inspectionId: saved.inspection.id }]);
  });

  it("sin cámara, sin geolocalización y sin procesamiento de imagen, la captura se completa sin bloquear la pantalla", async () => {
    // jsdom no trae mediaDevices, geolocation, permissions ni createImageBitmap: las capacidades faltan.
    const lab = "Laboratorio Sintético E2E-04";
    setOnline(true, { dispatch: false });
    openApp();
    await waitUntilReady();

    expect(screen.queryByRole("button", { name: "Abrir cámara" })).toBeNull();

    const syntheticPng = new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "equipo-sintetico.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Elegir imagen"), { target: { files: [syntheticPng] } });
    await waitFor(() => expect(screen.getByTestId("photo-status").textContent).toBe(PHOTO_MESSAGES["processing-unavailable"]));

    fireEvent.click(screen.getByRole("button", { name: "Agregar ubicación aproximada" }));
    await waitFor(() => expect(screen.getByTestId("location-status").textContent).toBe(LOCATION_MESSAGES.unsupported));

    fillAndSave(lab);
    await waitFor(() => expect(notice()).toBe("Sincronización completada. 1 inspección enviada al servidor."));
    expect(server.calls).toHaveLength(1);
    expect(server.calls[0]).toMatchObject({ status: 201, kind: "applied" });
    expect(await storedMutations()).toEqual([]);
    expect(screen.getByRole("button", { name: "Guardar sin conexión" })).toHaveProperty("disabled", false);
  });
});
