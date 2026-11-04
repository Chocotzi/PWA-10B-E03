import { listInspections, parseSimulate, type SimulateMode } from "../../../lib/inspections-repository";
import { readReleaseInfo, type ReadReleaseOptions, type ReleaseInfo } from "../../../lib/release/version";
import { jsonResponse } from "../../../lib/security";

export const dynamic = "force-dynamic";

export type HealthCheckStatus = "ok" | "error";

export type HealthPayload = {
  status: "ok" | "degraded";
  service: string;
  version: string;
  revision: string;
  buildId: string;
  environment: ReleaseInfo["environment"];
  checks: {
    releaseMetadata: HealthCheckStatus;
    repository: HealthCheckStatus;
  };
};

export type EvaluateHealthOptions = {
  simulate?: SimulateMode;
  releaseOptions?: ReadReleaseOptions;
};

export async function evaluateHealth(
  options: EvaluateHealthOptions = {},
): Promise<{ status: 200 | 503; payload: HealthPayload }> {
  const info = readReleaseInfo(options.releaseOptions);
  const releaseMetadata: HealthCheckStatus = info.validVersion ? "ok" : "error";

  let repository: HealthCheckStatus = "ok";
  try {
    const items = await listInspections(options.simulate ? { simulate: options.simulate, delayMs: 5 } : {});
    if (!Array.isArray(items) || items.length === 0) {
      repository = "error";
    }
  } catch {
    // T-03: no exponer mensajes internos de excepción en respuestas HTTP.
    repository = "error";
  }

  const healthy = releaseMetadata === "ok" && repository === "ok";
  return {
    status: healthy ? 200 : 503,
    payload: {
      status: healthy ? "ok" : "degraded",
      service: info.service,
      version: info.version,
      revision: info.revision,
      buildId: info.buildId,
      environment: info.environment,
      checks: {
        releaseMetadata,
        repository,
      },
    },
  };
}

export async function GET(request: Request): Promise<Response> {
  const simulate = parseSimulate(new URL(request.url).searchParams.get("simular"));
  const result = await evaluateHealth({ simulate });
  return jsonResponse(result.payload, result.status);
}

export async function HEAD(request: Request): Promise<Response> {
  const response = await GET(request);
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
}

