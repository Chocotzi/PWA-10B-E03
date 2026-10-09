import { describe, it, expect } from 'vitest';
import { captureImage } from '../src/lib/device/camera';
import { getCurrentLocation } from '../src/lib/device/geolocation';

describe('Device Capabilities', () => {
  describe('Camera API', () => {
    it('should return synthetic image data when fallback is triggered', async () => {
      const result = await captureImage(true);
      expect(result.success).toBe(true);
      expect(result.dataUrl).toContain('data:image');
    });

    it('should handle missing mediaDevices gracefully', async () => {
      const originalMediaDevices = global.navigator?.mediaDevices;
      if (global.navigator) {
        Object.defineProperty(global.navigator, 'mediaDevices', { value: undefined, configurable: true });
      }
      
      const result = await captureImage(false);
      expect(result.success).toBe(true);
      expect(result.error).toBe('Synthetic fallback triggered');

      if (global.navigator) {
        Object.defineProperty(global.navigator, 'mediaDevices', { value: originalMediaDevices, configurable: true });
      }
    });
  });

  describe('Geolocation API', () => {
    it('should return synthetic coordinates when fallback is triggered', async () => {
      const result = await getCurrentLocation(true);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.latitude).toBe(18.4627);
      expect(result.data?.longitude).toBe(-97.3928);
    });

    it('should handle missing geolocation API gracefully', async () => {
      const originalGeolocation = global.navigator?.geolocation;
      if (global.navigator) {
        Object.defineProperty(global.navigator, 'geolocation', { value: undefined, configurable: true });
      }
      
      const result = await getCurrentLocation(false);
      expect(result.success).toBe(true);
      expect(result.data?.accuracy).toBe(10);

      if (global.navigator) {
        Object.defineProperty(global.navigator, 'geolocation', { value: originalGeolocation, configurable: true });
      }
    });
  });
});
