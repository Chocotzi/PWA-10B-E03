import { getInspectionById, parseSimulate } from "@/lib/inspections-repository";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

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
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error del origen de datos" }, 500);
  }
}
