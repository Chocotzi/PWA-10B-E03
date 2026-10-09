import { describe, expect, it, vi } from "vitest";
import { getNotificationPermission, requestNotificationPermission, showLocalNotification } from "../src/lib/notifications/client";

describe("cliente de notificaciones sintéticas", () => {
  it("devuelve unsupported fuera de un navegador con Notification", () => {
    expect(getNotificationPermission()).toBe("unsupported");
  });

  it("solicita permiso y crea una notificación cuando se concede", async () => {
    const NotificationMock = vi.fn();
    Object.defineProperty(NotificationMock, "permission", { value: "default", writable: true });
    const requestPermission = vi.fn(async () => {
      Object.defineProperty(NotificationMock, "permission", { value: "granted", writable: true });
      return "granted" as NotificationPermission;
    });
    Object.defineProperty(NotificationMock, "requestPermission", { value: requestPermission });
    Object.defineProperty(globalThis, "window", { value: { Notification: NotificationMock }, configurable: true });
    Object.defineProperty(globalThis, "Notification", { value: NotificationMock, configurable: true });
    expect(await requestNotificationPermission()).toBe("granted");
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(showLocalNotification("Inspección sintética", { body: "Lista" })).toBeTruthy();
    expect(NotificationMock).toHaveBeenCalledWith("Inspección sintética", { body: "Lista" });
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { Notification?: unknown }).Notification;
  });
});
