import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { resolve } from "node:path";
import { vi } from "vitest";

type Listener = (event: any) => void;

/** Origen simulado del Service Worker (`self.location.origin`). */
export const ORIGIN = "https://example.test";

/**
 * El SW llama a `cache.addAll` con rutas (string) y a `fetch` con objetos Request,
 * así que el fetch simulado recibe los dos tipos de entrada.
 */
export type FetchImpl = (input: any) => Promise<Response>;

// Límites conocidos de esta simulación frente a un navegador real: la clave de caché
// ignora origen y query string, no modela `Vary`, cuota de almacenamiento ni respuestas
// opacas, y los eventos se despachan a mano. Por eso complementa (no reemplaza) la
// revisión manual en DevTools descrita en docs/cache-strategy.md.
class MemoryCache {
  private entries = new Map<string, Response>();

  constructor(private readonly fetchImpl: FetchImpl) {}

  private key(request: string | Request) {
    const value = typeof request === "string" ? request : request.url;
    return value.startsWith("http") ? new URL(value).pathname : value;
  }

  // Igual que `Cache.addAll` real, es atómico: primero se obtienen TODAS las respuestas y solo
  // si todas son 2xx se guardan. Si una falla no queda ninguna entrada parcial.
  async addAll(urls: string[]) {
    const responses = await Promise.all(urls.map(async (url) => {
      const response = await this.fetchImpl(url);
      if (!response.ok) throw new Error(`Unable to precache ${url}`);
      return [url, response] as const;
    }));
    for (const [url, response] of responses) {
      await this.put(url, response);
    }
  }

  async put(request: string | Request, response: Response) {
    this.entries.set(this.key(request), response.clone());
  }

  async match(request: string | Request) {
    return this.entries.get(this.key(request))?.clone();
  }
}

class MemoryCaches {
  stores = new Map<string, MemoryCache>();

  constructor(private readonly fetchImpl: FetchImpl) {}

  async open(name: string) {
    let cache = this.stores.get(name);
    if (!cache) {
      cache = new MemoryCache(this.fetchImpl);
      this.stores.set(name, cache);
    }
    return cache;
  }

  async keys() {
    return [...this.stores.keys()];
  }

  async delete(name: string) {
    return this.stores.delete(name);
  }

  async match(request: string | Request) {
    for (const cache of this.stores.values()) {
      const response = await cache.match(request);
      if (response) return response;
    }
    return undefined;
  }
}

export function createServiceWorkerHarness(fetchImpl: FetchImpl) {
  const listeners = new Map<string, Listener[]>();
  const caches = new MemoryCaches(fetchImpl);
  const skipWaiting = vi.fn();
  const self = {
    location: { origin: ORIGIN },
    clients: { claim: async () => undefined },
    skipWaiting,
    addEventListener(type: string, listener: Listener) {
      listeners.set(type, [...(listeners.get(type) || []), listener]);
    },
  };
  const source = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
  const context = createContext({
    self,
    caches,
    fetch: fetchImpl,
    URL,
    Promise,
    console,
  });
  runInContext(source, context);

  return {
    caches,
    skipWaiting,
    /** Lee una constante de nivel superior de sw.js (p. ej. CACHE_VERSION) como valor JSON. */
    read<T>(name: string): T {
      return JSON.parse(runInContext(`JSON.stringify(${name})`, context)) as T;
    },
    async dispatch(type: string, event: any) {
      const pending = (listeners.get(type) || []).map((listener) => listener(event));
      await Promise.all(pending);
      await Promise.all(event.promises || []);
      return event.responsePromise ? event.responsePromise : undefined;
    },
    install() {
      const promises: Promise<unknown>[] = [];
      return this.dispatch("install", {
        promises,
        waitUntil(promise: Promise<unknown>) { promises.push(promise); },
      });
    },
    activate() {
      const promises: Promise<unknown>[] = [];
      return this.dispatch("activate", {
        promises,
        waitUntil(promise: Promise<unknown>) { promises.push(promise); },
      });
    },
    fetch(request: any) {
      const promises: Promise<unknown>[] = [];
      const event = {
        request,
        promises,
        waitUntil(promise: Promise<unknown>) { promises.push(promise); },
        respondWith(promise: Promise<Response>) { event.responsePromise = promise; },
        responsePromise: undefined as Promise<Response> | undefined,
      };
      return this.dispatch("fetch", event).then(() => event.responsePromise);
    },
    /** Entrega un `postMessage` al worker, como haría la página con `registration.waiting.postMessage`. */
    message(data: unknown) {
      return this.dispatch("message", { data });
    },
  };
}

/**
 * Red simulada y controlable: por defecto responde 200 con `red:<ruta>`;
 * `respond` cambia la respuesta de una ruta y `goOffline` hace que todo `fetch` falle.
 */
export function createFakeNetwork() {
  let online = true;
  const routes = new Map<string, () => Response | Promise<Response>>();
  const calls: string[] = [];
  const fetchMock = vi.fn(async (input: string | { url: string }) => {
    const path = new URL(typeof input === "string" ? input : input.url, ORIGIN).pathname;
    calls.push(path);
    if (!online) throw new TypeError("Failed to fetch");
    const route = routes.get(path);
    return route ? route() : new Response(`red:${path}`);
  });

  return {
    fetch: fetchMock,
    /** Rutas pedidas a la red, en orden. */
    calls,
    goOffline() { online = false; },
    goOnline() { online = true; },
    respond(path: string, factory: () => Response | Promise<Response>) { routes.set(path, factory); },
  };
}

export type FakeRequest = {
  method: string;
  mode: string;
  url: string;
  headers: { get(name: string): string | null };
};

type RequestInitLike = { method?: string; origin?: string };

function fakeRequest(path: string, mode: string, accept: string, init: RequestInitLike): FakeRequest {
  return {
    method: init.method ?? "GET",
    mode,
    url: new URL(path, init.origin ?? ORIGIN).href,
    headers: { get: (name) => (name.toLowerCase() === "accept" ? accept : null) },
  };
}

/** Navegación de documento (`mode: "navigate"`, `Accept: text/html`). */
export function navigationRequest(path: string, init: RequestInitLike = {}): FakeRequest {
  return fakeRequest(path, "navigate", "text/html,application/xhtml+xml", init);
}

/** Subrecurso (script, estilo…) pedido por la página. */
export function assetRequest(path: string, init: RequestInitLike = {}): FakeRequest {
  return fakeRequest(path, "no-cors", "*/*", init);
}
