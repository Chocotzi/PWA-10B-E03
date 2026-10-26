import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getNotificationPermission,
  requestNotificationPermission,
  showLocalNotification,
} from "../../src/lib/notifications/client";

describe("Unit: Notifications Client Capability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns 'unsupported' when running in non-browser or when Notification is missing", () => {
    // In node environment without global window.Notification
    const perm = getNotificationPermission();
    expect(perm).toBe("unsupported");
  });

  it("returns 'unsupported' for permission request when Notification is not in window", async () => {
    const perm = await requestNotificationPermission();
    expect(perm).toBe("unsupported");
  });

  it("returns null when attempting to show notification without granted permission", () => {
    const result = showLocalNotification("Inspección sincronizada");
    expect(result).toBeNull();
  });

  it("reads permission and requests permission when window.Notification exists", async () => {
    const requestPermissionMock = vi.fn().mockResolvedValue("granted");
    class MockNotification {
      static permission: NotificationPermission = "default";
      static requestPermission = requestPermissionMock;
      title: string;
      options?: NotificationOptions;
      constructor(title: string, options?: NotificationOptions) {
        this.title = title;
        this.options = options;
      }
    }

    vi.stubGlobal("window", { Notification: MockNotification });
    vi.stubGlobal("Notification", MockNotification);

    expect(getNotificationPermission()).toBe("default");
    const requested = await requestNotificationPermission();
    expect(requested).toBe("granted");
    expect(requestPermissionMock).toHaveBeenCalled();
  });

  it("creates a notification when permission is granted", () => {
    class MockNotification {
      static permission: NotificationPermission = "granted";
      static requestPermission = vi.fn().mockResolvedValue("granted");
      title: string;
      options?: NotificationOptions;
      constructor(title: string, options?: NotificationOptions) {
        this.title = title;
        this.options = options;
      }
    }

    vi.stubGlobal("window", { Notification: MockNotification });
    vi.stubGlobal("Notification", MockNotification);

    const notif = showLocalNotification("Sincronización exitosa", {
      body: "Inspección de prueba guardada",
    });
    expect(notif).not.toBeNull();
    // @ts-expect-error checking mock property
    expect(notif?.title).toBe("Sincronización exitosa");
  });
});
