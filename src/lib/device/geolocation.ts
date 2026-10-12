/**
 * Ubicación aproximada y opcional para una inspección (docs/capabilities.md, CAP-02).
 *
 * Reglas:
 * - Solo se solicita cuando la persona pulsa «Agregar ubicación aproximada»; nunca al cargar.
 * - Lectura única con `getCurrentPosition`; nunca seguimiento con `watchPosition`.
 * - Sin alta precisión (`enableHighAccuracy: false`): basta con ubicar el edificio del laboratorio.
 * - Antes de guardar se redondea a 3 decimales (≈ 110 m) y la precisión declarada nunca es menor
 *   a 100 m, para no aparentar una exactitud que ya no existe.
 * - Si la API no existe, el contexto no es seguro, el permiso se niega o no hay respuesta, la
 *   inspección se guarda sin ubicación. No se inventan coordenadas: una ubicación falsa marcada
 *   como real contaminaría los datos de la inspección.
 */

export const LOCATION_DECIMALS = 3;
export const MIN_ACCURACY_METERS = 100;
export const LOCATION_TIMEOUT_MS = 10_000;
export const LOCATION_MAX_AGE_MS = 5 * 60 * 1000;
/**
 * Límite propio por si el navegador nunca llama a ningún callback. Pasa, por ejemplo, cuando la
 * persona ignora el diálogo de permiso: `timeout` de la API no empieza a contar hasta que hay permiso.
 */
export const LOCATION_GUARD_MS = 20_000;

export const LOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: LOCATION_TIMEOUT_MS,
  maximumAge: LOCATION_MAX_AGE_MS,
};

export type ApproximateLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
};

export type LocationFailure = "unsupported" | "insecure-context" | "denied" | "unavailable" | "timeout" | "error";

export type LocationResult =
  | { status: "ok"; location: ApproximateLocation }
  | { status: LocationFailure; message: string };

export type PositionLike = {
  coords: { latitude: number; longitude: number; accuracy: number };
  timestamp?: number;
};

export type PositionErrorLike = { code: number; message?: string };

export type GeolocationLike = {
  getCurrentPosition(
    success: (position: PositionLike) => void,
    error?: (error: PositionErrorLike) => void,
    options?: PositionOptions,
  ): void;
};

export type GeolocationEnvironment = {
  geolocation?: GeolocationLike;
  isSecureContext?: boolean;
  now?: () => Date;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

export const LOCATION_MESSAGES: Record<LocationFailure, string> = {
  unsupported: "Este navegador no ofrece geolocalización. Puedes guardar la inspección sin ubicación.",
  "insecure-context": "La ubicación solo funciona con HTTPS o en localhost. Puedes guardar la inspección sin ubicación.",
  denied: "Permiso de ubicación denegado. Puedes guardar la inspección sin ubicación.",
  unavailable: "No se pudo determinar la ubicación. Puedes reintentar o guardar sin ubicación.",
  timeout: "La ubicación tardó demasiado. Puedes reintentar o guardar sin ubicación.",
  error: "No se pudo leer la ubicación. Puedes guardar la inspección sin ubicación.",
};

export function browserGeolocationEnvironment(): GeolocationEnvironment {
  if (typeof window === "undefined" || typeof navigator === "undefined") return {};
  return { geolocation: navigator.geolocation, isSecureContext: window.isSecureContext };
}

export function isGeolocationSupported(env: GeolocationEnvironment = browserGeolocationEnvironment()): boolean {
  return env.isSecureContext !== false && typeof env.geolocation?.getCurrentPosition === "function";
}

export function roundCoordinate(value: number, decimals: number = LOCATION_DECIMALS): number {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return rounded === 0 ? 0 : rounded; // evita -0 en JSON y en comparaciones
}

export function toApproximateLocation(position: PositionLike, now: Date): ApproximateLocation | null {
  const { latitude, longitude, accuracy } = position.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  const timestamp = typeof position.timestamp === "number" && Number.isFinite(position.timestamp)
    ? new Date(position.timestamp)
    : now;

  return {
    latitude: roundCoordinate(latitude),
    longitude: roundCoordinate(longitude),
    accuracyMeters: Math.max(MIN_ACCURACY_METERS, Number.isFinite(accuracy) ? Math.round(accuracy) : 0),
    capturedAt: timestamp.toISOString(),
  };
}

export function classifyGeolocationError(error: PositionErrorLike | undefined): LocationFailure {
  switch (error?.code) {
    case 1: return "denied"; // PERMISSION_DENIED
    case 2: return "unavailable"; // POSITION_UNAVAILABLE
    case 3: return "timeout"; // TIMEOUT
    default: return "error";
  }
}

function failure(status: LocationFailure): LocationResult {
  return { status, message: LOCATION_MESSAGES[status] };
}

/**
 * Pide una sola lectura aproximada. La promesa nunca se rechaza: todo fallo se traduce en un
 * estado que la interfaz explica, y la inspección se puede guardar igual.
 */
export function requestApproximateLocation(
  env: GeolocationEnvironment = browserGeolocationEnvironment(),
): Promise<LocationResult> {
  const geolocation = env.geolocation;
  if (!geolocation || typeof geolocation.getCurrentPosition !== "function") {
    return Promise.resolve(failure("unsupported"));
  }
  if (env.isSecureContext === false) return Promise.resolve(failure("insecure-context"));

  const now = env.now ?? (() => new Date());
  const setTimer = env.setTimer ?? ((callback: () => void, ms: number) => setTimeout(callback, ms));
  const clearTimer = env.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  return new Promise<LocationResult>((resolve) => {
    let settled = false;
    let guard: unknown;
    const finish = (result: LocationResult) => {
      if (settled) return;
      settled = true;
      clearTimer(guard);
      resolve(result);
    };

    guard = setTimer(() => finish(failure("timeout")), LOCATION_GUARD_MS);

    try {
      geolocation.getCurrentPosition(
        (position) => {
          const location = toApproximateLocation(position, now());
          finish(location ? { status: "ok", location } : failure("unavailable"));
        },
        (error) => finish(failure(classifyGeolocationError(error))),
        LOCATION_OPTIONS,
      );
    } catch {
      // Algunos navegadores lanzan de forma síncrona si una política del documento bloquea la API.
      finish(failure("error"));
    }
  });
}
