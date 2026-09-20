import { describe, expect, it, vi } from "vitest";
import { createServiceWorkerHarness } from "./helpers/sw-harness";

describe("service worker (public/sw.js)", () => {
  it("precachea los recursos con instalación atómica", async () => {
    // Cubre RNF-05: el App Shell queda disponible sin red.
    const fetchMock = vi.fn(async (url: string) => new Response(url));
    const harness = createServiceWorkerHarness(fetchMock);
    await harness.install();
    const cache = await harness.caches.open("inspecciones-v1");
    expect(await cache.match("/")).toBeDefined();
    expect(await cache.match("/offline")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("elimina cachés antiguas al activar", async () => {
    // Cubre el punto 4 de docs/cache-strategy.md: invalidación controlada.
    const harness = createServiceWorkerHarness(async (url: string) => new Response(url));
    await harness.caches.open("inspecciones-v0");
    await harness.install();
    await harness.activate();
    expect(await harness.caches.keys()).toEqual(["inspecciones-v1"]);
  });

  it("responde /offline cuando una navegación falla y no está en caché", async () => {
    // Cubre RF-05/RNF-05: la navegación sin red usa el fallback offline.
    let online = true;
    const harness = createServiceWorkerHarness(async (url: string) => {
      if (!online) throw new Error("offline");
      if (url === "/offline") return new Response("offline page");
      return new Response(url === "/" ? "Inspecciones de laboratorio" : "resource");
    });
    await harness.install();
    online = false;
    const request = {
      method: "GET",
      mode: "navigate",
      url: "https://example.test/ruta-inexistente",
      headers: { get: () => "text/html" },
    };
    const response = await harness.fetch(request);
    expect(await response?.text()).toBe("offline page");
  });
});
