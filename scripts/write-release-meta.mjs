// Semana 10 · Tarea 1 (Cleber): escribe `.next/release-meta.json` de forma determinista tras el build.
//
// Uso:
//   node scripts/write-release-meta.mjs [--revision <sha-o-etiqueta>] [--root <directorio>] [--out <ruta>]
//
// No guarda marcas de tiempo variables para conservar reproducibilidad byte a byte para una misma revisión,
// ni escribe fuera de `.next/` por defecto. Valida que versión y revisión cumplan formatos estrictos.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

function parseArgs(argv) {
  const options = {
    root: resolve(import.meta.dirname, ".."),
    revision: null,
    out: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root" && index + 1 < argv.length) {
      options.root = resolve(argv[index + 1]);
      index += 1;
    } else if (arg === "--revision" && index + 1 < argv.length) {
      options.revision = argv[index + 1];
      index += 1;
    } else if (arg === "--out" && index + 1 < argv.length) {
      options.out = resolve(argv[index + 1]);
      index += 1;
    } else {
      console.error(`Argumento no reconocido o incompleto: ${arg}`);
      process.exit(1);
    }
  }
  return options;
}

function detectGitRevision(rootDir) {
  try {
    const sha = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return IDENTIFIER_PATTERN.test(sha) ? sha : "local";
  } catch {
    return "local";
  }
}

const args = parseArgs(process.argv.slice(2));
const pkgPath = resolve(args.root, "package.json");
if (!existsSync(pkgPath)) {
  console.error(`No se encontró package.json en ${args.root}`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const service = typeof pkg.name === "string" && IDENTIFIER_PATTERN.test(pkg.name.trim())
  ? pkg.name.trim()
  : "pwa-inspecciones-laboratorio";
const version = typeof pkg.version === "string" ? pkg.version.trim() : "";

if (!SEMVER_PATTERN.test(version)) {
  console.error(`Versión inválida en package.json: "${version}" (se esperaba SemVer X.Y.Z).`);
  process.exit(1);
}

let revision = "local";
if (args.revision !== null && args.revision !== "auto") {
  const candidate = args.revision.trim();
  if (!IDENTIFIER_PATTERN.test(candidate)) {
    console.error("Revisión de release inválida: solo se permiten [A-Za-z0-9._-] de 1 a 64 caracteres.");
    process.exit(1);
  }
  revision = candidate;
} else {
  revision = detectGitRevision(args.root);
}

const buildIdPath = resolve(args.root, ".next/BUILD_ID");
let buildId = "dev";
if (existsSync(buildIdPath)) {
  const rawBuildId = readFileSync(buildIdPath, "utf8").trim();
  if (IDENTIFIER_PATTERN.test(rawBuildId)) {
    buildId = rawBuildId;
  }
}

const metadata = {
  schemaVersion: 1,
  service,
  version,
  revision,
  buildId,
};

const target = args.out ?? resolve(args.root, ".next/release-meta.json");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
console.log(`Metadatos de release escritos: ${service}@${version} (${revision}, build=${buildId})`);

