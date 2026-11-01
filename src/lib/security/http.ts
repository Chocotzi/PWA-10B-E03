import { MAX_BODY_BYTES } from "./limits";

/**
 * Utilidades HTTP para endurecer endpoints de escritura (T-02, T-03, T-04).
 * Los mensajes de error son genéricos: no incluyen el valor recibido ni detalles internos.
 */
export type HttpErrorCode = "bad_request" | "forbidden" | "payload_too_large" | "unsupported_media_type" | "internal_error";

export const HTTP_ERRORS: Record<HttpErrorCode, { status: number; message: string }> = {
  bad_request: { status: 400, message: "Solicitud inválida" },
  forbidden: { status: 403, message: "Origen no permitido" },
  payload_too_large: { status: 413, message: "Cuerpo demasiado grande" },
  unsupported_media_type: { status: 415, message: "Content-Type debe ser application/json" },
  internal_error: { status: 500, message: "Error interno" },
};

export function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export function errorResponse(code: HttpErrorCode, extra?: Record<string, unknown>): Response {
  const entry = HTTP_ERRORS[code];
  return jsonResponse({ error: entry.message, code, ...(extra ?? {}) }, entry.status);
}

export function hasJsonContentType(request: Request): boolean {
  const header = request.headers.get("content-type");
  if (header === null) return false;
  const mediaType = header.split(";")[0].trim().toLowerCase();
  return mediaType === "application/json";
}

/**
 * Same-origin para escrituras. `Sec-Fetch-Site` lo fija el navegador y no puede falsificarlo una
 * página; sin él se compara `Origin` con el origen de la solicitud. Las llamadas sin ninguno de los
 * dos (curl, pruebas de servidor) se aceptan: no son una amenaza CSRF de navegador.
 */
export function isSameOriginRequest(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null) return site === "same-origin" || site === "none";
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export type BodyResult =
  | { ok: true; value: unknown }
  | { ok: false; code: "bad_request" | "payload_too_large" };

/**
 * Lee el cuerpo con tope real de bytes: cuenta lo recibido y cancela el flujo al excederlo, aun si
 * `Content-Length` falta o está falseado.
 */
export async function readJsonBody(request: Request, maxBytes: number = MAX_BODY_BYTES): Promise<BodyResult> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const length = Number(declared);
    if (Number.isFinite(length) && length > maxBytes) return { ok: false, code: "payload_too_large" };
  }
  if (!request.body) return { ok: false, code: "bad_request" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      received += chunk.value.byteLength;
      if (received > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, code: "payload_too_large" };
      }
      chunks.push(chunk.value);
    }
  } catch {
    return { ok: false, code: "bad_request" };
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (let index = 0; index < chunks.length; index += 1) {
    bytes.set(chunks[index], offset);
    offset += chunks[index].byteLength;
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, code: "bad_request" };
  }
}
