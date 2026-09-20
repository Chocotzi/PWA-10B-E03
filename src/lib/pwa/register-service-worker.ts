export type RegisterOptions = {
  onUpdateAvailable?: (registration: ServiceWorkerRegistration) => void;
};

export function isServiceWorkerSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator;
}

export async function registerServiceWorker(
  options: RegisterOptions = {}
): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported() || process.env.NODE_ENV !== "production") {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (!installing) {
        return;
      }

      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          options.onUpdateAvailable?.(registration);
        }
      });
    });

    return registration;
  } catch (error) {
    console.error("[pwa] registro fallido", error);
    return null;
  }
}

export function activateWaitingServiceWorker(registration: ServiceWorkerRegistration): void {
  if (!registration.waiting || typeof window === "undefined") {
    return;
  }

  let reloaded = false;
  const reloadOnce = () => {
    if (reloaded) {
      return;
    }
    reloaded = true;
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener("controllerchange", reloadOnce, { once: true });
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
}
