// Semana 8: resumen de una ejecución de CI en Markdown (para $GITHUB_STEP_SUMMARY).
// Lee el resultado de cada etapa (variables STAGE_*), los JUnit de test-results/ y la cobertura de
// coverage/coverage-summary.json. Nunca falla: si falta un reporte, lo indica en la tabla.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const stages = [
  ["Instalación limpia", "npm ci", "STAGE_INSTALL"],
  ["Lint", "npm run lint", "STAGE_LINT"],
  ["Tipos", "npm run typecheck", "STAGE_TYPECHECK"],
  ["Build de producción", "npm run build", "STAGE_BUILD"],
  ["Artefactos requeridos", "npm run verify", "STAGE_ARTIFACTS"],
  ["Unitarias", "npm run test:unit", "STAGE_UNIT", "test-results/unit.xml"],
  ["Integración", "npm run test:integration", "STAGE_INTEGRATION", "test-results/integration.xml"],
  ["E2E en jsdom", "npm run test:e2e", "STAGE_E2E", "test-results/e2e.xml"],
  ["Suite completa con cobertura", "npm test", "STAGE_COVERAGE", "test-results/junit.xml"],
  ["E2E en Chromium (next start)", "npm run test:e2e:browser", "STAGE_E2E_BROWSER", "test-results/e2e-browser.xml"],
];

const ICONS = { success: "✅ success", failure: "❌ failure", skipped: "⏭️ skipped", cancelled: "⏹️ cancelled" };

function junitTotals(file) {
  const path = resolve(root, file);
  if (!existsSync(path)) return "sin reporte";
  const header = readFileSync(path, "utf8").match(/<testsuites\b[^>]*>/)?.[0] ?? "";
  const read = (name) => Number(header.match(new RegExp(`\\b${name}="(\\d+)"`))?.[1] ?? 0);
  const tests = read("tests");
  const failed = read("failures") + read("errors");
  const skipped = read("skipped");
  return `${tests - failed - skipped}/${tests} pasan${failed ? ` · ${failed} fallan` : ""}${skipped ? ` · ${skipped} omitidas` : ""}`;
}

const lines = ["## Semana 8 · Verificación integral", ""];
const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_SHA } = process.env;
if (GITHUB_SHA) lines.push(`SHA: \`${GITHUB_SHA}\``, "");
lines.push("| Etapa | Comando | Resultado | Pruebas |", "| --- | --- | --- | --- |");
for (const [name, command, variable, report] of stages) {
  const outcome = process.env[variable] || "—";
  lines.push(`| ${name} | \`${command}\` | ${ICONS[outcome] ?? outcome} | ${report ? junitTotals(report) : ""} |`);
}

const coveragePath = resolve(root, "coverage/coverage-summary.json");
if (existsSync(coveragePath)) {
  const summary = JSON.parse(readFileSync(coveragePath, "utf8"));
  const pct = (metric) => `${summary.total[metric].pct}%`;
  lines.push(
    "",
    "### Cobertura de `src/` (suite completa)",
    "",
    "| Líneas | Sentencias | Funciones | Ramas |",
    "| --- | --- | --- | --- |",
    `| ${pct("lines")} | ${pct("statements")} | ${pct("functions")} | ${pct("branches")} |`,
    "",
    "Umbral de la Semana 6 (falla `npm test` si no se cumple): 95 % en `src/lib/device/**` y `src/lib/notifications/**` (90 % en ramas).",
  );
} else {
  lines.push("", "Cobertura: no se generó `coverage/coverage-summary.json`.");
}

if (GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID) {
  lines.push("", `Reportes en el artefacto \`academic-evaluation-s08-<SHA>\` de [esta ejecución](${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}).`);
}

console.log(lines.join("\n"));
