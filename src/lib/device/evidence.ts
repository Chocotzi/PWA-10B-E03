import type { EvidencePhoto } from "./camera";
import type { ApproximateLocation } from "./geolocation";

/**
 * Evidencia opcional de una inspección. Ambos campos son opcionales: una inspección sin evidencia
 * es válida y sigue el mismo flujo de captura y sincronización de la Semana 5.
 */
export type InspectionEvidence = {
  photo?: EvidencePhoto;
  location?: ApproximateLocation;
};

/** Devuelve `undefined` cuando no hay nada adjunto, para no guardar ni enviar objetos vacíos. */
export function normalizeEvidence(evidence: InspectionEvidence | undefined): InspectionEvidence | undefined {
  if (!evidence) return undefined;
  const normalized: InspectionEvidence = {};
  if (evidence.photo) normalized.photo = evidence.photo;
  if (evidence.location) normalized.location = evidence.location;
  return normalized.photo || normalized.location ? normalized : undefined;
}

export function describeEvidence(evidence: InspectionEvidence | undefined): string {
  const parts: string[] = [];
  if (evidence?.photo) parts.push("con foto");
  if (evidence?.location) parts.push("con ubicación aproximada");
  return parts.length > 0 ? parts.join(" y ") : "sin evidencia";
}
