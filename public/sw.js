const CACHE_VERSION = "inspecciones-v1";
const PRECACHE_URLS = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/icon-512x512-maskable.png",
];
// TODO S3.2 (Benkis): install con precache atómico, activate con limpieza de cachés
// antiguas, fetch con cache-first para /_next/static y network-first + fallback /offline
// para navegaciones, message SKIP_WAITING. Ver docs/cache-strategy.md.
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
