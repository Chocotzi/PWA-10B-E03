import { listInspections, parseSimulate } from "../../../lib/inspections-repository";
import {
  MAX_TRACKED_ACKNOWLEDGEMENTS,
  MAX_TRACKED_REVISIONS,
  createBoundedMap,
  errorResponse,
  hasJsonContentType,
  isSameOriginRequest,
  jsonResponse as json,
  readJsonBody,
  validateMutation,
} from "../../../lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const simulate = parseSimulate(new URL(request.url).searchParams.get("simular"));

  try {
    return json({ data: await listInspections({ simulate }) });
  } catch {
    // Sin `error.message`: los detalles internos no deben llegar al cliente (T-03).
    return json({ error: "Error del origen de datos" }, 500);
  }
}

type WriteResult =
  | { kind: "applied"; revision: string }
  | { kind: "conflict"; serverRevision: string | null };

// Acotados: una cantidad ilimitada de mutaciones distintas no puede agotar la memoria (T-02).
const revisions = createBoundedMap<string, string>(MAX_TRACKED_REVISIONS);
const acknowledgements = createBoundedMap<string, WriteResult>(MAX_TRACKED_ACKNOWLEDGEMENTS);

/**
 * Demo-only in-memory write endpoint. The check and write are synchronous in one
 * request handler, so a mutation is never applied after a stale revision check.
 * Orden: origen → Content-Type → cuerpo acotado → validación → lógica de idempotencia.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return errorResponse("forbidden");
  if (!hasJsonContentType(request)) return errorResponse("unsupported_media_type");

  const body = await readJsonBody(request);
  if (!body.ok) return errorResponse(body.code);

  const validation = validateMutation(body.value);
  if (!validation.ok) {
    return json({ error: "Mutación de inspección inválida", code: "invalid_mutation", issues: validation.issues }, 400);
  }
  const mutation = validation.value;

  try {
    const previous = acknowledgements.get(mutation.id);
    if (previous) return json(previous);

    const currentRevision = revisions.get(mutation.inspection.id) ?? null;
    if (currentRevision !== mutation.baseRevision) {
      const conflict: WriteResult = { kind: "conflict", serverRevision: currentRevision };
      acknowledgements.set(mutation.id, conflict);
      return json(conflict, 409);
    }

    const revision = `rev-${mutation.id}`;
    revisions.set(mutation.inspection.id, revision);
    const applied: WriteResult = { kind: "applied", revision };
    acknowledgements.set(mutation.id, applied);
    return json(applied, 201);
  } catch {
    return errorResponse("internal_error");
  }
}
