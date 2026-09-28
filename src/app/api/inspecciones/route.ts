import { listInspections, parseSimulate } from "@/lib/inspections-repository";

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
