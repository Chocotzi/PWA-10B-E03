import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { captureImage } from "../../src/lib/device/camera";
import { getCurrentLocation } from "../../src/lib/device/geolocation";

describe("Unit: Device Capabilities (Camera & Geolocation Fallbacks)", () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Camera Capability", () => {
    it("returns synthetic 1x1 image fallback when useSynthetic is true", async () => {
      const result = await captureImage(true);
      expect(result.success).toBe(true);
      expect(result.dataUrl).toContain("data:image/png;base64");
      expect(result.error).toBe("Synthetic fallback triggered");
    });

    it("gracefully falls back when navigator.mediaDevices is missing", async () => {
      const mockNav = { ...originalNavigator };
      // @ts-expect-error testing missing property
      delete mockNav.mediaDevices;
      vi.stubGlobal("navigator", mockNav);

      const result = await captureImage(false);
      expect(result.success).toBe(true);
      expect(result.dataUrl).toBeDefined();
      expect(result.error).toBe("Synthetic fallback triggered");
    });

    it("stops all stream tracks when real camera access succeeds to protect privacy", async () => {
      const stopFn = vi.fn();
      const mockStream = {
        getTracks: () => [{ stop: stopFn }, { stop: stopFn }],
      };

      vi.stubGlobal("navigator", {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(mockStream),
        },
      });

      const result = await captureImage(false);
      expect(result.success).toBe(true);
      expect(stopFn).toHaveBeenCalledTimes(2);
    });

    it("returns controlled failure result when camera permission is denied", async () => {
      vi.stubGlobal("navigator", {
        mediaDevices: {
          getUserMedia: vi.fn().mockRejectedValue(new Error("Permission denied by user")),
        },
      });

      const result = await captureImage(false);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied by user");
    });
  });

  describe("Geolocation Capability", () => {
    it("returns UTT synthetic coordinates when useSynthetic is true", async () => {
      const result = await getCurrentLocation(true);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        latitude: 18.4627,
        longitude: -97.3928,
        accuracy: 10,
      });
    });

    it("falls back to synthetic coordinates when navigator.geolocation is missing", async () => {
      const mockNav = { ...originalNavigator };
      // @ts-expect-error testing missing property
      delete mockNav.geolocation;
      vi.stubGlobal("navigator", mockNav);

      const result = await getCurrentLocation(false);
      expect(result.success).toBe(true);
      expect(result.data?.latitude).toBe(18.4627);
    });

    it("retrieves position when browser geolocation succeeds", async () => {
      vi.stubGlobal("navigator", {
        geolocation: {
          getCurrentPosition: (success: (pos: any) => void) => {
            success({
              coords: {
                latitude: 18.4500,
                longitude: -97.3900,
                accuracy: 5,
              },
            });
          },
        },
      });

      const result = await getCurrentLocation(false);
      expect(result.success).toBe(true);
      expect(result.data?.latitude).toBe(18.4500);
      expect(result.data?.accuracy).toBe(5);
    });

    it("returns error result when geolocation fails or timeout expires", async () => {
      vi.stubGlobal("navigator", {
        geolocation: {
          getCurrentPosition: (_success: any, error: (err: any) => void) => {
            error(new Error("User denied Geolocation"));
          },
        },
      });

      const result = await getCurrentLocation(false);
      expect(result.success).toBe(false);
      expect(result.error).toContain("User denied Geolocation");
    });
  });
});
