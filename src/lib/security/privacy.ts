import type { MutationStorage } from "../storage/schema";

/**
 * Privacidad aplicada (Semana 9, T-12, T-13, T-14).
 * El inventario es la fuente única: `docs/privacy-data-inventory.md` lo resume para personas y las
 * pruebas comprueban que cada campo de la mutación esté aquí. Todos los datos del curso son sintéticos,
 * pero se tratan como personales el nombre del responsable y la foto para practicar la minimización.
 */
export type DataCategory = "personal" | "operativo" | "tecnico";
export type DataLocation = "indexeddb" | "memoria-servidor" | "notificacion" | "cache" | "ninguna";

export type InventoryEntry = {
  /** Ruta del campo dentro de la mutación (`inspection.inspector`, `inspection.evidence.photo.dataUrl`…). */
  field: string;
  label: string;
  category: DataCategory;
  purpose: string;
  /** Dónde vive el dato mientras existe. */
  locations: DataLocation[];
  access: string;
  retention: string;
  minimization: string;
  /** Si es verdadero, `redactForLog` lo oculta en cualquier bitácora. */
  redactInLogs: boolean;
};

const LOCAL_AND_SERVER: DataLocation[] = ["indexeddb"];
const QUEUE_RETENTION = "En IndexedDB hasta que el servidor confirma la sincronización o la persona usa «Borrar datos locales».";

export const PRIVACY_INVENTORY: readonly InventoryEntry[] = [
  { field: "id", label: "Identificador de la mutación", category: "tecnico", purpose: "Idempotencia: evitar duplicados al reintentar el envío.", locations: ["indexeddb", "memoria-servidor"], access: "Aplicación y servidor de demostración.", retention: "Cola local hasta sincronizar; en el servidor mientras no se expulse del mapa acotado (5000).", minimization: "UUID aleatorio sin relación con la persona.", redactInLogs: false },
  { field: "baseRevision", label: "Revisión base", category: "tecnico", purpose: "Detectar conflictos de edición.", locations: ["indexeddb"], access: "Aplicación y servidor.", retention: QUEUE_RETENTION, minimization: "Valor opaco generado por el servidor.", redactInLogs: false },
  { field: "createdAt", label: "Fecha de creación de la mutación", category: "tecnico", purpose: "Ordenar el envío en cola.", locations: LOCAL_AND_SERVER, access: "Aplicación.", retention: QUEUE_RETENTION, minimization: "Solo marca de tiempo.", redactInLogs: false },
  { field: "status", label: "Estado de la mutación", category: "tecnico", purpose: "Distinguir pendiente de conflicto.", locations: LOCAL_AND_SERVER, access: "Aplicación.", retention: QUEUE_RETENTION, minimization: "Dos valores posibles.", redactInLogs: false },
  { field: "serverRevision", label: "Revisión del servidor en conflicto", category: "tecnico", purpose: "Mostrar y resolver un conflicto.", locations: LOCAL_AND_SERVER, access: "Aplicación.", retention: QUEUE_RETENTION, minimization: "Valor opaco.", redactInLogs: false },
  { field: "inspection.id", label: "Identificador de la inspección", category: "operativo", purpose: "Referenciar el registro.", locations: ["indexeddb", "memoria-servidor"], access: "Aplicación y servidor.", retention: QUEUE_RETENTION, minimization: "UUID aleatorio.", redactInLogs: false },
  { field: "inspection.location", label: "Laboratorio inspeccionado", category: "operativo", purpose: "Indicar el espacio revisado.", locations: ["indexeddb", "notificacion"], access: "Personal del laboratorio; la notificación local lo muestra.", retention: QUEUE_RETENTION, minimization: "Nombre del espacio, nunca un domicilio; máximo 80 caracteres.", redactInLogs: false },
  { field: "inspection.date", label: "Fecha de la inspección", category: "operativo", purpose: "Ordenar y consultar inspecciones.", locations: LOCAL_AND_SERVER, access: "Aplicación.", retention: QUEUE_RETENTION, minimization: "Solo fecha, sin hora.", redactInLogs: false },
  { field: "inspection.inspector", label: "Nombre del responsable", category: "personal", purpose: "Saber quién realizó la inspección.", locations: ["indexeddb"], access: "Solo la persona usuaria del dispositivo y el servidor al sincronizar.", retention: QUEUE_RETENTION, minimization: "En el curso es un nombre sintético; máximo 80 caracteres; nunca aparece en notificaciones ni bitácoras.", redactInLogs: true },
  { field: "inspection.status", label: "Resultado de la inspección", category: "operativo", purpose: "Clasificar sin incidencias o requiere atención.", locations: LOCAL_AND_SERVER, access: "Aplicación.", retention: QUEUE_RETENTION, minimization: "Dos valores posibles.", redactInLogs: false },
  { field: "inspection.statusLabel", label: "Texto del resultado", category: "operativo", purpose: "Mostrar el resultado en pantalla.", locations: LOCAL_AND_SERVER, access: "Aplicación.", retention: QUEUE_RETENTION, minimization: "Texto fijo; máximo 40 caracteres.", redactInLogs: false },
  { field: "inspection.findings", label: "Número de hallazgos", category: "operativo", purpose: "Priorizar mantenimiento.", locations: LOCAL_AND_SERVER, access: "Aplicación.", retention: QUEUE_RETENTION, minimization: "Entero entre 0 y 1000.", redactInLogs: false },
  { field: "inspection.summary", label: "Resumen libre", category: "personal", purpose: "Describir observaciones de la inspección.", locations: ["indexeddb"], access: "Solo la persona usuaria del dispositivo y el servidor al sincronizar.", retention: QUEUE_RETENTION, minimization: "Texto libre que podría contener datos personales: máximo 500 caracteres, se pide no escribirlos y se oculta en bitácoras.", redactInLogs: true },
  { field: "inspection.evidence", label: "Evidencia opcional", category: "operativo", purpose: "Agrupar foto y ubicación opcionales.", locations: ["indexeddb"], access: "Aplicación.", retention: QUEUE_RETENTION, minimization: "Opcional; no se guarda un objeto vacío.", redactInLogs: true },
  { field: "inspection.evidence.photo", label: "Foto de evidencia", category: "personal", purpose: "Documentar visualmente el hallazgo.", locations: ["indexeddb"], access: "Solo la persona usuaria del dispositivo y el servidor al sincronizar.", retention: QUEUE_RETENTION, minimization: "Opcional, solo JPEG reducido a 1280 px y 1 MiB; se vuelve a codificar, lo que elimina los metadatos EXIF originales.", redactInLogs: true },
  { field: "inspection.evidence.photo.mimeType", label: "Tipo de la foto", category: "tecnico", purpose: "Restringir el formato a JPEG.", locations: ["indexeddb"], access: "Aplicación.", retention: QUEUE_RETENTION, minimization: "Valor fijo image/jpeg.", redactInLogs: false },
  { field: "inspection.evidence.photo.dataUrl", label: "Contenido de la foto", category: "personal", purpose: "Contenido de la imagen.", locations: ["indexeddb"], access: "Solo la persona usuaria del dispositivo y el servidor al sincronizar.", retention: QUEUE_RETENTION, minimization: "Nunca se escribe en bitácoras ni notificaciones.", redactInLogs: true },
  { field: "inspection.evidence.photo.width", label: "Ancho de la foto", category: "tecnico", purpose: "Validar dimensiones.", locations: ["indexeddb"], access: "Aplicación.", retention: QUEUE_RETENTION, minimization: "Máximo 1280.", redactInLogs: false },
  { field: "inspection.evidence.photo.height", label: "Alto de la foto", category: "tecnico", purpose: "Validar dimensiones.", locations: ["indexeddb"], access: "Aplicación.", retention: QUEUE_RETENTION, minimization: "Máximo 1280.", redactInLogs: false },
  { field: "inspection.evidence.photo.bytes", label: "Tamaño de la foto", category: "tecnico", purpose: "Validar el límite de tamaño.", locations: ["indexeddb"], access: "Aplicación.", retention: QUEUE_RETENTION, minimization: "Máximo 1 MiB.", redactInLogs: false },
  { field: "inspection.evidence.photo.source", label: "Origen de la foto (cámara o archivo)", category: "tecnico", purpose: "Distinguir captura de selección.", locations: ["indexeddb"], access: "Aplicación.", retention: QUEUE_RETENTION, minimization: "Dos valores posibles.", redactInLogs: false },
  { field: "inspection.evidence.photo.capturedAt", label: "Momento de la foto", category: "tecnico", purpose: "Fecha de la evidencia.", locations: ["indexeddb"], access: "Aplicación.", retention: QUEUE_RETENTION, minimization: "Solo marca de tiempo.", redactInLogs: false },
  { field: "inspection.evidence.location", label: "Ubicación aproximada", category: "personal", purpose: "Situar la inspección sin precisión excesiva.", locations: ["indexeddb"], access: "Solo la persona usuaria del dispositivo y el servidor al sincronizar.", retention: QUEUE_RETENTION, minimization: "Opcional; se solicita solo tras un clic y se redondea a 3 decimales (unos 100 m).", redactInLogs: true },
  { field: "inspection.evidence.location.latitude", label: "Latitud", category: "personal", purpose: "Ubicación aproximada.", locations: ["indexeddb"], access: "Solo la persona usuaria del dispositivo y el servidor al sincronizar.", retention: QUEUE_RETENTION, minimization: "Redondeada a 3 decimales; nunca en bitácoras.", redactInLogs: true },
  { field: "inspection.evidence.location.longitude", label: "Longitud", category: "personal", purpose: "Ubicación aproximada.", locations: ["indexeddb"], access: "Solo la persona usuaria del dispositivo y el servidor al sincronizar.", retention: QUEUE_RETENTION, minimization: "Redondeada a 3 decimales; nunca en bitácoras.", redactInLogs: true },
  { field: "inspection.evidence.location.accuracyMeters", label: "Precisión de la ubicación", category: "tecnico", purpose: "Informar la incertidumbre.", locations: ["indexeddb"], access: "Aplicación.", retention: QUEUE_RETENTION, minimization: "Mínimo 100 m.", redactInLogs: false },
  { field: "inspection.evidence.location.capturedAt", label: "Momento de la ubicación", category: "tecnico", purpose: "Fecha de la evidencia.", locations: ["indexeddb"], access: "Aplicación.", retention: QUEUE_RETENTION, minimization: "Solo marca de tiempo.", redactInLogs: false },
];

/** Estado de permisos del navegador (cámara, ubicación, notificaciones): no se guarda ni se envía. */
export const PERMISSION_STATE_NOTE =
  "El estado de los permisos lo conserva el navegador; la aplicación lo consulta al momento, no lo almacena ni lo envía.";

export const REDACTED = "[redactado]";

export const SENSITIVE_LOG_KEYS: string[] = ["inspector", "summary", "evidence", "photo", "dataUrl", "latitude", "longitude"];
const MAX_REDACTION_DEPTH = 8;

function looksLikeDataUrl(value: string): boolean {
  return value.slice(0, 5).toLowerCase() === "data:";
}

/**
 * Copia segura para bitácoras: reemplaza responsable, resumen, evidencia, foto y coordenadas, y
 * cualquier data URL. Los errores se reducen a su nombre. No modifica el valor original.
 */
export function redactForLog(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return looksLikeDataUrl(value) ? REDACTED : value;
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Error) return { name: value.name };
  if (depth >= MAX_REDACTION_DEPTH) return REDACTED;
  if (Array.isArray(value)) return value.map((item) => redactForLog(item, depth + 1));
  const output: Record<string, unknown> = {};
  const keys = Object.keys(value);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    const item = (value as Record<string, unknown>)[key];
    output[key] = SENSITIVE_LOG_KEYS.indexOf(key) >= 0 ? REDACTED : redactForLog(item, depth + 1);
  }
  return output;
}

/** Borra toda la cola local (T-12). Devuelve cuántas mutaciones se eliminaron. */
export async function purgeLocalData(storage: MutationStorage): Promise<number> {
  const items = await storage.list();
  for (let index = 0; index < items.length; index += 1) {
    await storage.delete(items[index].id);
  }
  return items.length;
}
