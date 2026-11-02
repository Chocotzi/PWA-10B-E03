// Semana 9 · Tarea 2 (Carlos) · T-08: busca credenciales en el repositorio o en el bundle de Next.js.
//
//   node scripts/scan-secrets.mjs            archivos del repositorio (versionados y nuevos no ignorados)
//   node scripts/scan-secrets.mjs --bundle   lo que recibe el navegador después de `npm run build`
//
// Usa las reglas de src/lib/security/secrets.ts (las mismas que prueba tests/security.spec.ts). Excluye
// node_modules/, los lockfiles (sus hashes de integridad no son credenciales) y archivos binarios.
// Termina con código 1 si hay hallazgos y escribe reports/secrets-scan*.json. Ni la consola ni el
// reporte muestran el valor completo de lo encontrado.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { importTypeScriptModule } from "./lib/import-ts.mjs";

const root = resolve(import.meta.dirname, "..");
const bundleMode = process.argv.includes("--bundle");
const { scanForSecrets, isSensitiveFileName } = await importTypeScriptModule(resolve(root, "src/lib/security/secrets.ts"));

const EXCLUDED_DIRS = new Set(["node_modules", ".git", ".next", "coverage", "test-results", "playwright-report", "blob-report", "out", "build"]);
const LOCKFILES = new Set(["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml"]);
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".bmp",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".zip", ".gz", ".tgz", ".br", ".pdf", ".mp3", ".mp4", ".webm", ".wasm",
]);
const MAX_BYTES = 5 * 1024 * 1024;

const toPosix = (path) => path.split("\\").join("/");

function walk(directory, skipDirs) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) files.push(...walk(path, skipDirs));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}

/** Archivos del repositorio: lo versionado y lo nuevo que git no ignora, es decir, lo que podría subirse. */
function repositoryFiles() {
  try {
    const output = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    });
    return { source: "git ls-files", files: output.split("\0").filter(Boolean).map((file) => resolve(root, file)) };
  } catch {
    // Sin git (por ejemplo, un ZIP descargado): se recorre la carpeta con las mismas exclusiones.
    return { source: "recorrido de carpetas", files: walk(root, EXCLUDED_DIRS) };
  }
}

/** Lo que Next.js entrega al navegador: estáticos del cliente y páginas prerenderizadas. */
function bundleFiles() {
  const staticDir = resolve(root, ".next/static");
  if (!existsSync(staticDir)) {
    console.error("No existe .next/static: ejecuta `npm run build` antes de `npm run scan:secrets -- --bundle`.");
    process.exit(2);
  }
  const files = walk(staticDir, new Set());
  const appDir = resolve(root, ".next/server/app");
  if (existsSync(appDir)) files.push(...walk(appDir, new Set()).filter((file) => /\.(?:html|rsc|body|meta)$/.test(file)));
  return { source: ".next/static y páginas prerenderizadas", files };
}

function isExcluded(relativePath) {
  const parts = relativePath.split("/");
  if (!bundleMode && parts.slice(0, -1).some((part) => EXCLUDED_DIRS.has(part))) return true;
  const name = parts[parts.length - 1];
  return LOCKFILES.has(name) || BINARY_EXTENSIONS.has(extname(name).toLowerCase());
}

const { source, files } = bundleMode ? bundleFiles() : repositoryFiles();
const findings = [];
let scanned = 0;

for (const file of files) {
  const path = toPosix(relative(root, file));
  if (isExcluded(path) || !existsSync(file)) continue;
  if (!bundleMode && isSensitiveFileName(path)) {
    findings.push({ file: path, line: 1, column: 1, rule: "sensitive-file", description: "Archivo de credenciales o variables de entorno", redacted: "(archivo completo)" });
  }
  if (statSync(file).size > MAX_BYTES) continue;
  const buffer = readFileSync(file);
  if (buffer.includes(0)) continue; // binario sin extensión conocida
  scanned += 1;
  for (const finding of scanForSecrets(buffer.toString("utf8"))) findings.push({ file: path, ...finding });
}

const mode = bundleMode ? "bundle" : "repositorio";
const report = resolve(root, bundleMode ? "reports/secrets-scan-bundle.json" : "reports/secrets-scan.json");
mkdirSync(dirname(report), { recursive: true });
writeFileSync(
  report,
  `${JSON.stringify({ schemaVersion: 1, mode, source, checkedAt: new Date().toISOString(), filesScanned: scanned, status: findings.length === 0 ? "pass" : "fail", findings }, null, 2)}\n`,
);

if (findings.length > 0) {
  console.error(`Escaneo de secretos (${mode}): ${findings.length} hallazgo(s) en ${scanned} archivos revisados.`);
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line}:${finding.column}  ${finding.rule}  ${finding.description}  [${finding.redacted}]`);
  }
  console.error("Quita el valor del archivo, rótalo si llegó a subirse y vuelve a ejecutar el escaneo.");
  process.exit(1);
}

console.log(`Escaneo de secretos (${mode}): PASS, 0 hallazgos en ${scanned} archivos (${source}).`);
console.log(`Reporte: ${toPosix(relative(root, report))}`);
