/**
 * Consulta el estado de un permiso SIN solicitarlo.
 *
 * Sirve para explicar el estado antes de que la persona pulse un botón (por ejemplo, «la ubicación
 * está bloqueada en este navegador»). Nunca abre el diálogo del navegador: el diálogo solo se abre
 * desde `openCamera`, `requestApproximateLocation` o `requestNotificationPermission`, y la interfaz
 * solo los llama dentro de un manejador de clic.
 */

export type DevicePermissionName = "camera" | "geolocation" | "notifications";

export type PermissionStateValue = "granted" | "denied" | "prompt" | "unknown";

export type PermissionsLike = {
  query(descriptor: { name: string }): Promise<{ state: string }>;
};

export function browserPermissions(): PermissionsLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { permissions?: PermissionsLike }).permissions;
}

export async function queryPermission(
  name: DevicePermissionName,
  permissions: PermissionsLike | undefined = browserPermissions(),
): Promise<PermissionStateValue> {
  if (!permissions || typeof permissions.query !== "function") return "unknown";
  try {
    const status = await permissions.query({ name });
    return status.state === "granted" || status.state === "denied" || status.state === "prompt"
      ? status.state
      : "unknown";
  } catch {
    // Firefox y Safari no reconocen todos los nombres (por ejemplo "camera") y lanzan TypeError.
    return "unknown";
  }
}
