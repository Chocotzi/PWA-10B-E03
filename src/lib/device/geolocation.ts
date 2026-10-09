export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface GeolocationResult {
  success: boolean;
  data?: LocationData;
  error?: string;
}

export async function getCurrentLocation(useSynthetic: boolean = true): Promise<GeolocationResult> {
  // Fallback: Si no hay soporte, el permiso es denegado o se requiere dato sintético
  if (useSynthetic || typeof navigator === 'undefined' || !navigator.geolocation) {
    return {
      success: true,
      data: { latitude: 18.4627, longitude: -97.3928, accuracy: 10 }, // UTT syntethic coordinate
    };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          success: true,
          data: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          },
        });
      },
      (error) => {
        resolve({
          success: false,
          error: error.message,
        });
      },
      { timeout: 5000, maximumAge: 60000 }
    );
  });
}
