// @vitest-environment jsdom

import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { InspectionCaptureClient } from "../../src/components/inspection-capture-client";
import { captureImage } from "../../src/lib/device/camera";
import { getCurrentLocation } from "../../src/lib/device/geolocation";

describe("E2E: Critical Inspection Flow in User Interface", () => {
  let fakeFactory: IDBFactory;

  beforeEach(() => {
    fakeFactory = new IDBFactory();
    // Inyectar fake indexedDB en globalThis
    vi.stubGlobal("indexedDB", fakeFactory);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("flujo crítico: crear -> guardar offline -> recargar sin perder -> reconectar -> sincronizar sin duplicar", async () => {
    // 1. Simular estado offline en el navegador
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true, writable: true });

    const { unmount } = render(React.createElement(InspectionCaptureClient));

    // Esperar a que el storage inicialice
    await waitFor(() => {
      expect(screen.getByText(/Captura local lista/i)).toBeDefined();
    });

    // 2. Llenar y enviar formulario de captura
    const locationInput = screen.getByLabelText(/Laboratorio sintético/i);
    const summaryInput = screen.getByLabelText(/Resumen sintético/i);
    const saveButton = screen.getByRole("button", { name: /Guardar sin conexión/i });

    fireEvent.change(locationInput, { target: { value: "Laboratorio de IA y Robótica" } });
    fireEvent.change(summaryInput, { target: { value: "Inspección E2E de prueba offline." } });
    fireEvent.click(saveButton);

    // 3. Comprobar que se guardó localmente en modo offline
    await waitFor(() => {
      expect(screen.getByText(/Inspección sintética guardada localmente/i)).toBeDefined();
      expect(screen.getByText(/Laboratorio de IA y Robótica/i)).toBeDefined();
      expect(screen.getByText(/Pendiente de sincronizar/i)).toBeDefined();
    });

    // 4. Simular recarga de página (desmontar y volver a renderizar el componente)
    unmount();

    // Configurar respuesta de API para cuando se reconecte
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ kind: "applied", revision: "rev-e2e-ok" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(React.createElement(InspectionCaptureClient));

    // Verificar que tras la "recarga" la inspección sigue intacta
    await waitFor(() => {
      expect(screen.getByText(/Laboratorio de IA y Robótica/i)).toBeDefined();
    });

    // 5. Simular evento de reconexión (online)
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true, writable: true });
    window.dispatchEvent(new Event("online"));

    // 6. Verificar que se sincroniza y la cola se vacía sin duplicar
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Sincronización terminada/i)).toBeDefined();
    });
  });

  it("permite completar la captura de inspección cuando una capacidad de dispositivo es denegada o falta", async () => {
    // Simular que la cámara deniega el permiso
    const cameraResult = await captureImage(true); // fallback sintético
    expect(cameraResult.success).toBe(true);
    expect(cameraResult.dataUrl).toContain("data:image/png;base64");

    // Simular ausencia de geolocalización
    const locationResult = await getCurrentLocation(true); // fallback sintético
    expect(locationResult.success).toBe(true);
    expect(locationResult.data?.latitude).toBe(18.4627);

    // Renderizar y guardar inspección
    render(React.createElement(InspectionCaptureClient));

    await waitFor(() => {
      expect(screen.getByText(/Captura local lista/i)).toBeDefined();
    });

    const saveButton = screen.getByRole("button", { name: /Guardar sin conexión/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/Inspección sintética guardada localmente/i)).toBeDefined();
    });
  });
});
