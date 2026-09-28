// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { inspections } from "../src/lib/data/inspections";
import { getInspectionById, isValidInspectionId, listInspections } from "../src/lib/inspections-repository";
import { ErrorState } from "../src/components/error-state";
import { LoadingState } from "../src/components/loading-state";
import { InspectionsListClient } from "../src/components/inspections-list-client";

const notFound = vi.hoisted(() => vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }));
const emptySearchParams = vi.hoisted(() => new URLSearchParams());
vi.mock("next/navigation", () => ({ notFound, useSearchParams: () => emptySearchParams }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: unknown }) => createElement("a", { href, ...props }, children),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("repositorio y límites de datos", () => {
  it("valida identificadores estrictos", () => {
    expect(isValidInspectionId("inspection-001")).toBe(true);
    expect(isValidInspectionId("inspection-1")).toBe(false);
    expect(isValidInspectionId("hola")).toBe(false);
    expect(isValidInspectionId("../etc")).toBe(false);
  });

  it("maneja ids inexistentes y errores simulados", async () => {
    await expect(getInspectionById("inspection-999")).resolves.toBeNull();
    await expect(getInspectionById("inspection-001", { simulate: "error" })).rejects.toThrow("Fallo simulado del origen de datos");
  });

  it("cumple los límites y la coherencia RF-04", async () => {
    const data = await listInspections();
    expect(data.length).toBeGreaterThanOrEqual(3);
    expect(data.length).toBeLessThanOrEqual(20);
    for (const item of data) {
      expect(item.id).toMatch(/^inspection-\d{3}$/);
      expect(item.findings).toBeGreaterThanOrEqual(0);
      expect(item.findings).toBeLessThanOrEqual(10);
      expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(item.status).toBe(item.findings === 0 ? "ok" : "attention");
      for (const value of Object.values(item)) {
        if (typeof value === "string") expect(value.length).toBeLessThanOrEqual(280);
      }
    }
  });
});

describe("estados accesibles", () => {
  it("anuncia carga y permite reintentar el error", () => {
    render(createElement(LoadingState));
    expect(screen.getByRole("status").textContent).toContain("Cargando inspecciones");
    const onRetry = vi.fn();
    render(createElement(ErrorState, { title: "Error", message: "Intenta de nuevo", onRetry }));
    expect(screen.getByRole("alert").textContent).toContain("Intenta de nuevo");
    screen.getByRole("button", { name: "Reintentar" }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe("listado CSR", () => {
  it("muestra carga inicial sin tarjetas", () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, options?: { signal?: AbortSignal }) =>
      new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
    ));
    render(createElement(InspectionsListClient));
    expect(screen.getByTestId("loading-state")).toBeTruthy();
    expect(screen.queryByRole("article")).toBeNull();
  });

  it("muestra tarjetas después de fetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: inspections })));
    render(createElement(InspectionsListClient));
    expect((await screen.findAllByText("Laboratorio de Redes")).length).toBeGreaterThan(0);
  });

  it("se recupera después de un 500", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 500 })).mockResolvedValueOnce(Response.json({ data: inspections }));
    vi.stubGlobal("fetch", fetchMock);
    render(createElement(InspectionsListClient));
    expect(await screen.findByTestId("error-state")).toBeTruthy();
    screen.getByRole("button", { name: "Reintentar" }).click();
    expect((await screen.findAllByText("Laboratorio de Redes")).length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("filtra las inspecciones que requieren atención", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: inspections })));
    render(createElement(InspectionsListClient));
    await screen.findByText("6 registros");
    const select = screen.getByLabelText("Filtrar inspecciones") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "attention" } });
    await waitFor(() => expect(screen.getByText("3 registros")).toBeTruthy());
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(3);
    expect(cards.every((card) => card.textContent?.includes("Requiere atención"))).toBe(true);
  });
});

describe("detalle SSR", () => {
  it("renderiza datos sin fetch y contiene los seis campos", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { default: Page } = await import("../src/app/inspecciones/[id]/page");
    const element = await Page({ params: Promise.resolve({ id: "inspection-002" }), searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element);
    expect(html).toContain("Laboratorio de Electrónica");
    for (const field of ["Ubicación", "Fecha", "Responsable", "Estado", "Hallazgos", "Resumen"]) expect(html).toContain(field);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("usa notFound para un id inexistente", async () => {
    const { default: Page } = await import("../src/app/inspecciones/[id]/page");
    await expect(Page({ params: Promise.resolve({ id: "inspection-999" }), searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("propaga el error simulado", async () => {
    const { default: Page } = await import("../src/app/inspecciones/[id]/page");
    await expect(Page({ params: Promise.resolve({ id: "inspection-002" }), searchParams: Promise.resolve({ simular: "error" }) })).rejects.toThrow("Fallo simulado del origen de datos");
  });
});

describe("hidratación inicial", () => {
  it("mantiene el mismo marcado de carga", () => {
    const serverMarkup = renderToStaticMarkup(createElement(LoadingState));
    const { container } = render(createElement(LoadingState));
    expect(container.innerHTML).toBe(serverMarkup);
  });
});
