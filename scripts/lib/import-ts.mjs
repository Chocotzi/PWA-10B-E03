// Semana 9 · Tarea 2 (Carlos): importa un módulo TypeScript autocontenido desde un archivo .mjs.
//
// `next.config.mjs` y `scripts/scan-secrets.mjs` corren en Node sin compilar, y Node 20 (`.nvmrc`) no
// ejecuta TypeScript. Necesitan la misma política que prueban Vitest y Playwright
// (`src/lib/security/headers.ts` y `secrets.ts`). Para no duplicarla, este helper quita los tipos con el
// compilador `typescript` (dependencia del proyecto que Next.js ya exige para compilar) e importa el
// JavaScript resultante como módulo `data:`, sin escribir archivos.
//
// Límite: el módulo no puede importar otros archivos (un módulo `data:` no resuelve rutas relativas).
// Next.js solo llama a `headers()` en `next build` y `next dev`; `next start` usa los encabezados ya
// guardados en `.next/routes-manifest.json`, así que servir la aplicación no necesita `typescript`.
import { readFile } from "node:fs/promises";

/**
 * @param {string} path ruta absoluta del archivo .ts
 * @returns {Promise<Record<string, any>>} las exportaciones del módulo
 */
export async function importTypeScriptModule(path) {
  const { default: ts } = await import("typescript");
  const source = await readFile(path, "utf8");
  const { outputText } = ts.transpileModule(source, {
    fileName: path,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      isolatedModules: true,
    },
  });
  if (/^\s*import[\s{*]/m.test(outputText)) {
    throw new Error(`${path} debe ser autocontenido (sin import) para cargarse desde un archivo .mjs`);
  }
  return import(`data:text/javascript;base64,${Buffer.from(outputText, "utf8").toString("base64")}`);
}
