/**
 * Avisos de cambio: inspección guardada, sincronizada o en conflicto (docs/capabilities.md, CAP-03).
 *
 * El aviso dentro de la página (región `aria-live`) es el canal garantizado. La notificación del
 * sistema es una mejora progresiva: solo se usa si la persona la activó con el botón «Activar
 * avisos» y el navegador la soporta. Orden de intento:
 *   1. `ServiceWorkerRegistration.showNotification` (obligatorio en Chrome para Android, donde
 *      `new Notification()` lanza `TypeError: Illegal constructor`).
 *   2. `new Notification()` en escritorio cuando no hay service worker (por ejemplo con `npm run dev`).
 *   3. Si ambos fallan, solo queda el aviso en la página. Nunca se lanza un error a la interfaz.
 *
 * Se usa `navigator.serviceWorker.getRegistration()` y no `.ready`, porque `.ready` nunca se resuelve
 * cuando no hay worker registrado y dejaría el aviso esperando para siempre.
 *
 * Primera versión: Benkis (b37c1e7). Esta versión conserva sus funciones públicas.
 */

export type NotificationPermissionState = NotificationPermission | "unsupported";

export type NotificationConstructorLike = {
  readonly permission: NotificationPermission;
  requestPermission(callback?: (permission: NotificationPermission) => void): Promise<NotificationPermission> | void;
  new (title: string, options?: NotificationOptions): unknown;
};

export type RegistrationLike = {
  showNotification(title: string, options?: NotificationOptions): Promise<void>;
};

export type NotificationEnvironment = {
  Notification?: NotificationConstructorLike;
  getRegistration?: () => Promise<RegistrationLike | null | undefined>;
};

export type ChangeNotice = {
  title: string;
  body: string;
  /** Mismo `tag` = la notificación nueva reemplaza a la anterior en lugar de acumularse. */
  tag: string;
  url?: string;
};

export type InAppReason = "unsupported" | "permission-default" | "permission-denied" | "failed";

export type NotifyResult =
  | { channel: "system"; via: "service-worker" | "page" }
  | { channel: "in-app"; reason: InAppReason };

export const NOTIFICATION_ICON = "/icons/icon-192x192.png";
export const NOTIFICATION_DEFAULT_URL = "/inspecciones";
const MAX_TITLE = 60;
const MAX_BODY = 140;

export function browserNotificationEnvironment(): NotificationEnvironment {
  const scope = globalThis as typeof globalThis & { window?: { Notification?: NotificationConstructorLike } };
  if (typeof scope.window === "undefined" || !scope.window) return {};
  const serviceWorker = typeof navigator !== "undefined" && "serviceWorker" in navigator ? navigator.serviceWorker : undefined;
  return {
    Notification: scope.window.Notification,
    getRegistration: serviceWorker && typeof serviceWorker.getRegistration === "function"
      ? () => serviceWorker.getRegistration()
      : undefined,
  };
}

export function getNotificationPermission(env: NotificationEnvironment = browserNotificationEnvironment()): NotificationPermissionState {
  return env.Notification ? env.Notification.permission : "unsupported";
}

/**
 * Pide permiso solo si todavía no hay decisión. Llamar únicamente desde un clic.
 * Acepta la API moderna (promesa) y la antigua de Safari (callback).
 */
export async function requestNotificationPermission(
  env: NotificationEnvironment = browserNotificationEnvironment(),
): Promise<NotificationPermissionState> {
  const api = env.Notification;
  if (!api) return "unsupported";
  if (api.permission !== "default") return api.permission; // no se vuelve a preguntar
  try {
    return await new Promise<NotificationPermission>((resolve, reject) => {
      const pending = api.requestPermission(resolve) as Promise<NotificationPermission> | undefined;
      if (pending && typeof pending.then === "function") pending.then(resolve, reject);
    });
  } catch {
    return api.permission;
  }
}

function limit(text: string, max: number): string {
  const clean = text.trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * Muestra el aviso como notificación del sistema si hay permiso; si no, indica que solo debe
 * mostrarse dentro de la página. Nunca rechaza.
 */
export async function notifyChange(
  notice: ChangeNotice,
  env: NotificationEnvironment = browserNotificationEnvironment(),
): Promise<NotifyResult> {
  const api = env.Notification;
  if (!api) return { channel: "in-app", reason: "unsupported" };
  if (api.permission === "denied") return { channel: "in-app", reason: "permission-denied" };
  if (api.permission !== "granted") return { channel: "in-app", reason: "permission-default" };

  const title = limit(notice.title, MAX_TITLE);
  const options: NotificationOptions = {
    body: limit(notice.body, MAX_BODY),
    tag: notice.tag,
    icon: NOTIFICATION_ICON,
    data: { url: notice.url ?? NOTIFICATION_DEFAULT_URL },
  };

  try {
    const registration = env.getRegistration ? await env.getRegistration() : undefined;
    if (registration && typeof registration.showNotification === "function") {
      await registration.showNotification(title, options);
      return { channel: "system", via: "service-worker" };
    }
  } catch {
    // Si el worker falla se intenta el constructor de página.
  }

  try {
    new api(title, options);
    return { channel: "system", via: "page" };
  } catch {
    return { channel: "in-app", reason: "failed" };
  }
}

/** Compatibilidad con la primera versión: muestra una notificación de página si hay permiso. */
export function showLocalNotification(
  title: string,
  options?: NotificationOptions,
  env: NotificationEnvironment = browserNotificationEnvironment(),
): Notification | null {
  if (!env.Notification || env.Notification.permission !== "granted") return null;
  try {
    return new env.Notification(title, options) as Notification;
  } catch {
    return null;
  }
}

/**
 * Textos de los avisos. Solo incluyen el laboratorio y el estado: nunca el responsable ni el
 * resumen, porque una notificación puede verse en la pantalla bloqueada.
 */
export function savedNotice(inspection: { id: string; location: string }, online: boolean): ChangeNotice {
  return {
    title: "Inspección guardada",
    body: `${inspection.location}: ${online ? "guardada en el dispositivo; sincronizando." : "guardada sin conexión; se enviará al volver la red."}`,
    tag: `inspeccion-${inspection.id}`,
  };
}

export function syncNotice(result: { sent: number; conflicts: number }): ChangeNotice | null {
  if (result.conflicts > 0) {
    return {
      title: "Conflicto de sincronización",
      body: `${result.conflicts} ${result.conflicts === 1 ? "inspección requiere" : "inspecciones requieren"} revisión; la copia local se conservó.`,
      tag: "sincronizacion-conflicto",
    };
  }
  if (result.sent > 0) {
    return {
      title: "Sincronización completada",
      body: `${result.sent} ${result.sent === 1 ? "inspección enviada" : "inspecciones enviadas"} al servidor.`,
      tag: "sincronizacion-resultado",
    };
  }
  return null;
}

export function inAppText(notice: ChangeNotice): string {
  return `${notice.title}. ${notice.body}`;
}
