/**
 * Semana 9 · Tarea 2 (Carlos) · encabezados de seguridad del navegador (T-05, T-06, T-11).
 *
 * Fuente única de la política. `next.config.mjs` la publica con `headers()` y la revisan
 * `tests/security.spec.ts` (bloque 2) y `tests/e2e/security-headers.pw.ts` (Chromium contra `next start`).
 * Este archivo no importa nada a propósito: `next.config.mjs` lo carga con `scripts/lib/import-ts.mjs`,
 * que solo quita los tipos (Node 20 no ejecuta TypeScript).
 *
 * Decisión de CSP: `'unsafe-inline'` en `script-src` y no un nonce por petición. Next.js inserta en cada
 * página scripts en línea con los datos de React Server Components. Un nonce obliga a renderizar todas
 * las rutas en cada petición (`/offline` e `/inspecciones` dejan de ser estáticas), y el service worker
 * guarda HTML que, sin red, se volvería a servir con el mismo nonce: un valor repetido ya no demuestra
 * nada. Lo que compensa: sin `'unsafe-eval'` en producción, sin comodines ni dominios externos,
 * `object-src 'none'`, `base-uri`, `form-action` y `frame-ancestors` cerrados, y React escapa el contenido
 * (no se usa `dangerouslySetInnerHTML`). Análisis completo en `docs/threat-model.md`, sección 8.2.
 */

export type SecurityOptions = {
  /** `true` en `next build` / `next start`; `false` en `next dev` y en las pruebas. */
  production: boolean;
};

export type HeaderEntry = { key: string; value: string };
export type HeaderCondition = { type: "header"; key: string; value?: string };
export type HeaderRule = { source: string; has?: HeaderCondition[]; headers: HeaderEntry[] };

/** Directivas de la CSP en el orden en que se publican. */
export function cspDirectives({ production }: SecurityOptions): Record<string, string[]> {
  return {
    "default-src": ["'self'"],
    // React usa eval() en desarrollo para reconstruir pilas de llamadas; en producción queda prohibido.
    "script-src": production ? ["'self'", "'unsafe-inline'"] : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    // data: para la foto de evidencia (JPEG en data URL) y blob: para vistas previas locales.
    "img-src": ["'self'", "data:", "blob:"],
    // Solo la API propia: también limita a dónde podría enviar datos un script inyectado.
    "connect-src": ["'self'"],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
}

/** Valor del encabezado `Content-Security-Policy`. */
export function buildCsp(options: SecurityOptions = { production: true }): string {
  const directives = cspDirectives(options);
  return Object.keys(directives)
    .map((name) => [name].concat(directives[name]).join(" "))
    .join("; ");
}

/** Separa una CSP en directivas. Si una directiva se repite, vale la primera, como en el navegador. */
export function parseCsp(header: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  header.split(";").forEach((part) => {
    const tokens = part.trim().split(/\s+/).filter((token) => token.length > 0);
    if (tokens.length === 0) return;
    const name = tokens[0].toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(result, name)) result[name] = tokens.slice(1);
  });
  return result;
}

/**
 * CSP propia del service worker. El navegador aplica al worker la CSP con la que se sirve `/sw.js`;
 * un worker no ejecuta scripts en línea ni necesita eval, así que no hereda esas excepciones.
 */
export const SERVICE_WORKER_CSP = "default-src 'self'; script-src 'self'";

/**
 * Cámara y ubicación solo para este origen (la captura de evidencia de la Semana 6); micrófono y el resto
 * de APIs sensibles, denegados para todos. Además impide delegar cámara o ubicación a un iframe externo.
 */
export const PERMISSIONS_POLICY_FEATURES: Record<string, string> = {
  camera: "(self)",
  geolocation: "(self)",
  microphone: "()",
  "display-capture": "()",
  payment: "()",
  usb: "()",
  serial: "()",
  hid: "()",
  "browsing-topics": "()",
};

export const PERMISSIONS_POLICY = Object.keys(PERMISSIONS_POLICY_FEATURES)
  .map((feature) => `${feature}=${PERMISSIONS_POLICY_FEATURES[feature]}`)
  .join(", ");

/** Dentro del sitio se conserva la URL completa; a otros sitios no se envía nada. */
export const REFERRER_POLICY = "same-origin";

/** Dos años, sin `preload`: incluirse en la lista de precarga exige controlar todo el dominio. */
export const HSTS_VALUE = "max-age=63072000; includeSubDomains";

/**
 * HSTS solo cuando la petición llegó por HTTPS a un proxy que lo indica (Vercel, Nginx, Caddy).
 * Sobre HTTP el navegador ignora HSTS de todos modos, así que falsear este encabezado no tiene efecto.
 */
export const HTTPS_FORWARDED: HeaderCondition = { type: "header", key: "x-forwarded-proto", value: "https" };

/** Encabezados comunes a todas las respuestas (páginas, API, estáticos y archivos de `public/`). */
export function securityHeaders(options: SecurityOptions): HeaderEntry[] {
  return [
    { key: "Content-Security-Policy", value: buildCsp(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: REFERRER_POLICY },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    // Respaldo de `frame-ancestors 'none'` para navegadores sin CSP nivel 2.
    { key: "X-Frame-Options", value: "DENY" },
  ];
}

/**
 * Reglas para `headers()` de `next.config.mjs`. Si dos reglas fijan el mismo encabezado en una ruta,
 * Next.js aplica la última: por eso la de `/sw.js` va al final y reemplaza la CSP general.
 */
export function nextHeaderRules(options: SecurityOptions): HeaderRule[] {
  const rules: HeaderRule[] = [{ source: "/:path*", headers: securityHeaders(options) }];
  if (options.production) {
    rules.push({
      source: "/:path*",
      has: [HTTPS_FORWARDED],
      headers: [{ key: "Strict-Transport-Security", value: HSTS_VALUE }],
    });
  }
  // La API ya responde no-store (src/lib/security/http.ts); la regla lo garantiza aunque un handler
  // nuevo lo olvide. El service worker tampoco guarda respuestas no-store (T-10).
  rules.push({ source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] });
  // El worker se revalida en cada visita para que una versión nueva llegue sin esperar a la caché HTTP.
  rules.push({
    source: "/sw.js",
    headers: [
      { key: "Cache-Control", value: "no-cache" },
      { key: "Content-Security-Policy", value: SERVICE_WORKER_CSP },
    ],
  });
  return rules;
}
