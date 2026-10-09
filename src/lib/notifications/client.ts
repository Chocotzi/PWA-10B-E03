export type NotificationPermissionState = NotificationPermission | "unsupported";

export function getNotificationPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return window.Notification.requestPermission();
}

export function showLocalNotification(title: string, options?: NotificationOptions): Notification | null {
  if (getNotificationPermission() !== "granted") return null;
  return new window.Notification(title, options);
}
