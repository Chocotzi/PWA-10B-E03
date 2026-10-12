"use client";

import { useEffect, useState } from "react";
import {
  browserNotificationEnvironment,
  getNotificationPermission,
  requestNotificationPermission,
  type NotificationEnvironment,
  type NotificationPermissionState,
} from "../lib/notifications/client";

const DESCRIPTIONS: Record<NotificationPermissionState | "checking", string> = {
  checking: "Comprobando si este navegador admite avisos…",
  default: "Avisos del sistema desactivados. Los cambios se anuncian en esta página.",
  granted: "Avisos del sistema activados para inspecciones guardadas, sincronizadas o en conflicto.",
  denied: "Avisos bloqueados en este navegador. Los cambios se anuncian en esta página.",
  unsupported: "Este navegador no ofrece notificaciones. Los cambios se anuncian en esta página.",
};

/**
 * Estado y activación de los avisos del sistema. El permiso se pide solo al pulsar el botón;
 * nunca al cargar la página (docs/capabilities.md §2).
 */
export function NotificationPreferences({ env }: { env?: NotificationEnvironment }) {
  const [permission, setPermission] = useState<NotificationPermissionState | "checking">("checking");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    setPermission(getNotificationPermission(env ?? browserNotificationEnvironment()));
  }, [env]);

  async function enable() {
    setRequesting(true);
    setPermission(await requestNotificationPermission(env ?? browserNotificationEnvironment()));
    setRequesting(false);
  }

  return (
    <div className="notification-preferences">
      <p className="notification-state" data-testid="notification-state">{DESCRIPTIONS[permission]}</p>
      {permission === "default" && (
        <button type="button" className="secondary-button" onClick={() => void enable()} disabled={requesting}>
          Activar avisos
        </button>
      )}
    </div>
  );
}
