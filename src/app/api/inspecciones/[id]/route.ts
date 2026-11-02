import { getInspectionById, parseSimulate } from "../../../../lib/inspections-repository";
import { jsonResponse as json } from "../../../../lib/security";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const simulate = parseSimulate(new URL(request.url).searchParams.get("simular"));

  try {
    const inspection = await getInspectionById(id, { simulate });
    return inspection
      ? json({ data: inspection })
      : json({ error: "Inspección no encontrada" }, 404);
  } catch {
    // Sin `error.message`: los detalles internos no deben llegar al cliente (T-03).
    return json({ error: "Error del origen de datos" }, 500);
  }
}
