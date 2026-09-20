import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { resolve } from "node:path";

type Listener = (event: any) => void;

class MemoryCache {
  private entries = new Map<string, Response>();

  constructor(private readonly fetchImpl: (input: string) => Promise<Response>) {}

  private key(request: string | Request) {
    const value = typeof request === "string" ? request : request.url;
    return value.startsWith("http") ? new URL(value).pathname : value;
  }

  async addAll(urls: string[]) {
    await Promise.all(urls.map(async (url) => {
      const response = await this.fetchImpl(url);
      if (!response.ok) throw new Error(`Unable to precache ${url}`);
      await this.put(url, response);
    }));
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

  constructor(private readonly fetchImpl: (input: string) => Promise<Response>) {}

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

export function createServiceWorkerHarness(fetchImpl: (input: string) => Promise<Response>) {
  const listeners = new Map<string, Listener[]>();
  const caches = new MemoryCaches(fetchImpl);
  const self = {
    location: { origin: "https://example.test" },
    clients: { claim: async () => undefined },
    skipWaiting: () => undefined,
    addEventListener(type: string, listener: Listener) {
      listeners.set(type, [...(listeners.get(type) || []), listener]);
    },
  };
  const source = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
  runInNewContext(source, {
    self,
    caches,
    fetch: fetchImpl,
    URL,
    Promise,
    console,
  });

  return {
    caches,
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
  };
}
