import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next.js 16 genera AGENTS.md / CLAUDE.md en cada `next dev`.
  // Se desactiva para mantener el repositorio acotado a los entregables del curso.
  agentRules: false,
  // Fija la raíz del proyecto para Turbopack. Sin esto, Next intenta inferirla y
  // puede subir de carpeta si el equipo de un integrante tiene un pnpm-workspace.yaml
  // o un lockfile en un directorio superior.
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url))
  }
};

export default nextConfig;

