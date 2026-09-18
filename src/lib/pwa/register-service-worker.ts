export type RegisterOptions = {
  onUpdateAvailable?: (registration: ServiceWorkerRegistration) => void;
};

export function isServiceWorkerSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator;
}

export async function registerServiceWorker(
  _options: RegisterOptions = {}
): Promise<ServiceWorkerRegistration | null> {
  // TODO S3.3 (Cleber): registrar /sw.js solo en producción, manejar updatefound,
  // console.error en fallos, nunca lanzar ni bloquear la carga.
  if (!isServiceWorkerSupported() || process.env.NODE_ENV !== "production") {
    return null;
  }
  return null;
}

export function activateWaitingServiceWorker(registration: ServiceWorkerRegistration): void {
  registration.waiting?.postMessage({ type: "SKIP_WAITING" });
}
