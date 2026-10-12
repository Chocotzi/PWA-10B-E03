const CACHE_VERSION = "inspecciones-v1";
const PRECACHE_URLS = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/icon-512x512-maskable.png",
];

function isCacheable(response) {
  if (!response || !response.ok) {
    return false;
  }

  const cacheControl = response.headers.get("Cache-Control") || "";
  return !/\bno-store\b/i.test(cacheControl);
}

async function cacheResponse(cache, request, response) {
  if (isCacheable(response)) {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((error) => {
        console.error("[sw] instalación fallida", error);
        throw error;
      }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_VERSION)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  const acceptsHtml = (request.headers.get("Accept") || "").includes("text/html");
  if (request.mode === "navigate" || acceptsHtml) {
    event.respondWith(networkFirstNavigation(request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_VERSION);
    return cacheResponse(cache, request, response);
  } catch (error) {
    console.error("[sw] cache-first request failed", error);
    throw error;
  }
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_VERSION);
    return cacheResponse(cache, request, response);
  } catch (error) {
    console.error("[sw] navigation request failed", error);
    const cached = await caches.match(request);
    return cached || caches.match("/offline");
  }
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// --- Semana 6: notificaciones push y clic en avisos (docs/capabilities.md, CAP-04) ----------
// El worker muestra un push entrante y enfoca la aplicación al pulsar un aviso. No hay
// suscripción ni servidor de envío: eso exigiría un par de claves VAPID cuya parte privada no
// puede vivir en el repositorio. Se prueba con DevTools → Application → Service workers → Push.
const NOTIFICATION_DEFAULTS = {
  title: "Inspecciones de laboratorio",
  body: "Hay cambios en las inspecciones.",
  tag: "inspecciones-push",
  url: "/inspecciones",
};
const NOTIFICATION_ICON = "/icons/icon-192x192.png";

function limitText(value, max) {
  if (typeof value !== "string") {
    return "";
  }
  const text = value.trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// Solo rutas del mismo origen: un push no puede usarse para abrir un sitio externo.
function sameOriginPath(value) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin ? `${url.pathname}${url.search}` : null;
  } catch (error) {
    return null;
  }
}

function readPushPayload(data) {
  if (!data) {
    return Object.assign({}, NOTIFICATION_DEFAULTS);
  }

  let payload = null;
  try {
    payload = data.json();
  } catch (error) {
    payload = null;
  }

  if (!payload || typeof payload !== "object") {
    // DevTools envía texto plano («Test push message from DevTools.»).
    let text = "";
    try {
      text = data.text();
    } catch (error) {
      text = "";
    }
    return Object.assign({}, NOTIFICATION_DEFAULTS, { body: limitText(text, 160) || NOTIFICATION_DEFAULTS.body });
  }

  return {
    title: limitText(payload.title, 80) || NOTIFICATION_DEFAULTS.title,
    body: limitText(payload.body, 160) || NOTIFICATION_DEFAULTS.body,
    tag: limitText(payload.tag, 64) || NOTIFICATION_DEFAULTS.tag,
    url: sameOriginPath(payload.url) || NOTIFICATION_DEFAULTS.url,
  };
}

self.addEventListener("push", (event) => {
  const message = readPushPayload(event.data);
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      icon: NOTIFICATION_ICON,
      data: { url: message.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const path = sameOriginPath(data.url) || NOTIFICATION_DEFAULTS.url;
  event.waitUntil(focusOrOpen(path));
});

async function focusOrOpen(path) {
  const target = new URL(path, self.location.origin);
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) {
    const url = new URL(client.url);
    if (url.origin === target.origin && url.pathname === target.pathname && typeof client.focus === "function") {
      return client.focus();
    }
  }
  return self.clients.openWindow ? self.clients.openWindow(target.href) : null;
}
