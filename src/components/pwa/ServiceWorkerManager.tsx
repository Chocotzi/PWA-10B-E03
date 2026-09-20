"use client";

import { useEffect, useState } from "react";
import {
  activateWaitingServiceWorker,
  registerServiceWorker,
} from "../../lib/pwa/register-service-worker";

export function ServiceWorkerManager() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    let active = true;

    void registerServiceWorker({
      onUpdateAvailable: (nextRegistration) => {
        if (active) {
          setRegistration(nextRegistration);
        }
      },
    });

    return () => {
      active = false;
    };
  }, []);

  if (!registration) {
    return null;
  }

  return (
    <aside className="update-notice" role="status" aria-live="polite">
      <p>Hay una nueva versión disponible.</p>
      <button type="button" onClick={() => activateWaitingServiceWorker(registration)}>
        Actualizar
      </button>
    </aside>
  );
}
