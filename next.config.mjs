import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { importTypeScriptModule } from "./scripts/lib/import-ts.mjs";

const root = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next.js 16 genera AGENTS.md / CLAUDE.md en cada `next dev`.
  // Se desactiva para mantener el repositorio acotado a los entregables del curso.
  agentRules: false,
  // Semana 9 (T-03): no anunciar el framework con `X-Powered-By: Next.js`.
  poweredByHeader: false,
  // Fija la raíz del proyecto para Turbopack. Sin esto, Next intenta inferirla y
  // puede subir de carpeta si el equipo de un integrante tiene un pnpm-workspace.yaml
  // o un lockfile en un directorio superior.
  turbopack: {
    root,
  },
  // Semana 9 · Tarea 2 (Carlos): CSP, nosniff, Referrer-Policy, Permissions-Policy, COOP y HSTS (solo en
  // producción detrás de HTTPS). La política vive en src/lib/security/headers.ts, una sola fuente que
  // prueban Vitest y el E2E en Chromium. Next.js llama a esta función en `next build` y `next dev`.
  async headers() {
    const { nextHeaderRules } = await importTypeScriptModule(resolve(root, "src/lib/security/headers.ts"));
    return nextHeaderRules({ production: process.env.NODE_ENV === "production" });
  },
};

export default nextConfig;
