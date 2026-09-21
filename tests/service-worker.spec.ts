import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assetRequest,
  createFakeNetwork,
  createServiceWorkerHarness,
  navigationRequest,
} from "./helpers/sw-harness";

afterEach(() => {
  vi.restoreAllMocks();
});

/** Recursos mínimos del App Shell que deben poder abrirse sin red. */
const SHELL_URLS = ["/", "/offline", "/manifest.webmanifest"];

/**
 * Indica cómo termina una promesa. "pending" delata una promesa colgada sin esperar
 * el timeout global de Vitest.
 */
async function settlement(promise: Promise<unknown>, ms = 250): Promise<"resolved" | "rejected" | "pending"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise.then(() => "resolved" as const, () => "rejected" as const),
      new Promise<"pending">((resolve) => {
        timer = setTimeout(() => resolve("pending"), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

describe("service worker (public/sw.js)", () => {
  it("precachea exactamente PRECACHE_URLS en CACHE_VERSION con instalación atómica", async () => {
    // Contrato 1/11. Cubre RNF-05: el App Shell queda disponible sin red.
    const network = createFakeNetwork();
    const harness = createServiceWorkerHarness(network.fetch);
    const urls = harness.read<string[]>("PRECACHE_URLS");
    const version = harness.read<string>("CACHE_VERSION");

    await harness.install();

    expect(urls).toEqual(expect.arrayContaining(SHELL_URLS));
    expect([...network.calls].sort()).toEqual([...urls].sort());
    const cache = await harness.caches.open(version);
    for (const url of urls) {
      expect(await cache.match(url), `${url} debe quedar guardado en ${version}`).toBeDefined();
    }
    expect(await harness.caches.keys()).toEqual([version]);
  });

  it.each([
    ["responde 500", () => new Response("error", { status: 500 })],
    ["responde 404", () => new Response("no existe", { status: 404 })],
    ["falla la red", () => { throw new TypeError("Failed to fetch"); }],
  ])("la instalación falla completa si un recurso del precache %s", async (_caso, failing) => {
    // Contrato 2/11. Cubre el ciclo de vida de docs/cache-strategy.md: sin App Shell a medias.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const network = createFakeNetwork();
    network.respond("/offline", failing);
    const harness = createServiceWorkerHarness(network.fetch);
    const urls = harness.read<string[]>("PRECACHE_URLS");
    const version = harness.read<string>("CACHE_VERSION");

    await expect(harness.install()).rejects.toThrow();

    const cache = await harness.caches.open(version);
    for (const url of urls) {
      expect(await cache.match(url), `${url} no debe quedar guardado tras una instalación fallida`).toBeUndefined();
    }
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("[sw]"), expect.anything());
  });

  it("elimina cachés antiguas al activar", async () => {
    // Cubre el punto 4 de docs/cache-strategy.md: invalidación controlada. Contrato 3/11.
    const harness = createServiceWorkerHarness(async (url: string) => new Response(url));
    await harness.caches.open("inspecciones-v0");
    await harness.install();
    await harness.activate();
    expect(await harness.caches.keys()).toEqual(["inspecciones-v1"]);
  });

  it("sirve /_next/static desde la caché sin llamar a la red (cache-first)", async () => {
    // Contrato 4/11. Los estáticos de Next están versionados: reutilizarlos es seguro.
    const network = createFakeNetwork();
    network.respond("/_next/static/x.js", () => new Response("versión de red"));
    const harness = createServiceWorkerHarness(network.fetch);
    const cache = await harness.caches.open(harness.read<string>("CACHE_VERSION"));
    await cache.put("/_next/static/x.js", new Response("copia en caché"));

    const response = await harness.fetch(assetRequest("/_next/static/x.js"));

    expect(await response?.text()).toBe("copia en caché");
    expect(network.fetch).not.toHaveBeenCalled();
  });

  it("una navegación con red responde la red y actualiza la copia en caché (network-first)", async () => {
    // Contrato 5/11. Las inspecciones cambian: con red siempre se prefiere la versión nueva.
    const network = createFakeNetwork();
    network.respond("/", () => new Response("portada v1"));
    const harness = createServiceWorkerHarness(network.fetch);
    await harness.install();
    network.respond("/", () => new Response("portada v2"));
    network.fetch.mockClear();

    const response = await harness.fetch(navigationRequest("/"));

    expect(await response?.text()).toBe("portada v2");
    expect(network.fetch).toHaveBeenCalledTimes(1);
    const cache = await harness.caches.open(harness.read<string>("CACHE_VERSION"));
    expect(await (await cache.match("/"))?.text()).toBe("portada v2");
  });

  it("una navegación sin red y con copia en caché responde la copia", async () => {
    // Contrato 6/11. Cubre RF-05/RNF-05: consultar lo ya visitado sin conexión.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const network = createFakeNetwork();
    network.respond("/inspecciones", () => new Response("lista de inspecciones"));
    network.respond("/offline", () => new Response("Sin conexión"));
    const harness = createServiceWorkerHarness(network.fetch);
    await harness.install();
    await harness.fetch(navigationRequest("/inspecciones"));
    network.goOffline();

    const response = await harness.fetch(navigationRequest("/inspecciones"));

    expect(await response?.text()).toBe("lista de inspecciones");
  });

  it("responde /offline cuando una navegación falla y no está en caché", async () => {
    // Cubre RF-05/RNF-05: la navegación sin red usa el fallback offline. Contrato 7/11.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
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

  it.each([
    ["un POST a una página", () => navigationRequest("/", { method: "POST" })],
    ["una ruta /api/**", () => navigationRequest("/api/inspecciones")],
    ["otro origen", () => assetRequest("/_next/static/x.js", { origin: "https://otro.test" })],
  ])("no intercepta %s (no llama respondWith)", async (_caso, build) => {
    // Contrato 8/11. Caso negativo: el SW no debe tocar escrituras, backend ni terceros.
    const network = createFakeNetwork();
    const harness = createServiceWorkerHarness(network.fetch);
    await harness.install();
    network.fetch.mockClear();

    const response = await harness.fetch(build());

    expect(response).toBeUndefined();
    expect(network.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["una navegación con estado 500", "/inspecciones", navigationRequest, () => new Response("error", { status: 500 })],
    [
      "una navegación con Cache-Control: no-store",
      "/inspecciones",
      navigationRequest,
      () => new Response("privado", { headers: { "Cache-Control": "private, no-store" } }),
    ],
    ["un estático con estado 500", "/_next/static/chunk.js", assetRequest, () => new Response("error", { status: 500 })],
    [
      "un estático con Cache-Control: no-store",
      "/_next/static/chunk.js",
      assetRequest,
      () => new Response("privado", { headers: { "Cache-Control": "no-store" } }),
    ],
  ])("no guarda en caché %s", async (_caso, path, build, response) => {
    // Contrato 9/11. Cubre RNF-07: no persistir errores ni respuestas que prohíben almacenarse.
    const network = createFakeNetwork();
    network.respond(path, response);
    const harness = createServiceWorkerHarness(network.fetch);
    await harness.install();

    const handled = await harness.fetch(build(path));

    expect(handled, "el SW debe atender la solicitud, no ignorarla").toBeDefined();
    const cache = await harness.caches.open(harness.read<string>("CACHE_VERSION"));
    expect(await cache.match(path), `${path} no debe guardarse`).toBeUndefined();
  });

  it("control del contrato 9: un estático 200 sin no-store sí se guarda y se reutiliza", async () => {
    // Evita que las pruebas de "no guarda" pasen por accidente: aquí la regla sí permite guardar.
    const network = createFakeNetwork();
    network.respond("/_next/static/chunk.js", () => new Response("js"));
    const harness = createServiceWorkerHarness(network.fetch);
    await harness.install();

    await harness.fetch(assetRequest("/_next/static/chunk.js"));
    await harness.fetch(assetRequest("/_next/static/chunk.js"));

    const cache = await harness.caches.open(harness.read<string>("CACHE_VERSION"));
    expect(await cache.match("/_next/static/chunk.js")).toBeDefined();
    expect(network.calls.filter((path) => path === "/_next/static/chunk.js")).toHaveLength(1);
  });

  it("no llama a skipWaiting sin el mensaje SKIP_WAITING (install, activate ni otros mensajes)", async () => {
    // Contrato 10/11. La activación anticipada mezclaría HTML y scripts de versiones distintas.
    const harness = createServiceWorkerHarness(createFakeNetwork().fetch);

    await harness.install();
    await harness.activate();
    await harness.message({ type: "OTRO_MENSAJE" });
    await harness.message(undefined);

    expect(harness.skipWaiting).not.toHaveBeenCalled();
  });

  it("el mensaje SKIP_WAITING llama a skipWaiting una sola vez", async () => {
    // Contrato 10/11. Es el paso final del flujo "Actualizar" confirmado por el usuario.
    const harness = createServiceWorkerHarness(createFakeNetwork().fetch);

    await harness.message({ type: "SKIP_WAITING" });

    expect(harness.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it("registra con console.error el fallo de una navegación y su promesa se resuelve", async () => {
    // Contrato 11/11. Observabilidad (docs/cache-strategy.md, sección 6) sin promesas colgadas.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const network = createFakeNetwork();
    network.respond("/offline", () => new Response("Sin conexión"));
    const harness = createServiceWorkerHarness(network.fetch);
    await harness.install();
    network.goOffline();

    const pending = harness.fetch(navigationRequest("/ruta-nueva"));

    await expect(settlement(pending)).resolves.toBe("resolved");
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("[sw]"), expect.anything());
  });

  it("registra con console.error el fallo de un estático sin copia y su promesa se rechaza", async () => {
    // Contrato 11/11. Sin copia ni red no hay respuesta posible: debe fallar, nunca quedar pendiente.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const network = createFakeNetwork();
    const harness = createServiceWorkerHarness(network.fetch);
    await harness.install();
    network.goOffline();

    const pending = harness.fetch(assetRequest("/_next/static/nuevo.js"));

    await expect(settlement(pending)).resolves.toBe("rejected");
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("[sw]"), expect.anything());
  });
});
