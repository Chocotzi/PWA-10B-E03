import { listInspections, parseSimulate } from "@/lib/inspections-repository";
import type { PendingMutation } from "@/lib/storage/schema";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const simulate = parseSimulate(new URL(request.url).searchParams.get("simular"));

  try {
    return json({ data: await listInspections({ simulate }) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error del origen de datos" }, 500);
  }
}

type WriteResult =
  | { kind: "applied"; revision: string }
  | { kind: "conflict"; serverRevision: string | null };

const revisions = new Map<string, string>();
const acknowledgements = new Map<string, WriteResult>();

function isMutation(value: unknown): value is PendingMutation {
  if (!value || typeof value !== "object") return false;
  const mutation = value as Partial<PendingMutation>;
  return typeof mutation.id === "string" && mutation.id.length > 0
    && (typeof mutation.baseRevision === "string" || mutation.baseRevision === null)
    && typeof mutation.inspection?.id === "string" && mutation.inspection.id.length > 0;
}

/**
 * Demo-only in-memory write endpoint. The check and write are synchronous in one
 * request handler, so a mutation is never applied after a stale revision check.
 */
export async function POST(request: Request) {
  let mutation: PendingMutation;
  try {
    mutation = await request.json() as PendingMutation;
  } catch {
    return json({ error: "El cuerpo debe contener una mutación JSON" }, 400);
  }
  if (!isMutation(mutation)) return json({ error: "Mutación de inspección inválida" }, 400);

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
}
