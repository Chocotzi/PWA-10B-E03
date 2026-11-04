import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Semana 10 · Tarea 1 (Cleber) · identidad de versión y metadatos reproducibles de release.
 *
 * Lee la versión declarada en `package.json` y los metadatos generados durante el build
 * (`.next/release-meta.json` y `.next/BUILD_ID`) sin introducir nuevas lecturas de `process.env`
 * dentro de `src/`, conservando el invariante de seguridad T-08 de la Semana 9.
 */

export const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
export const RELEASE_IDENTIFIER_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export const DEFAULT_SERVICE_NAME = "pwa-inspecciones-laboratorio";
export const DEFAULT_REVISION = "local";
export const DEFAULT_BUILD_ID = "dev";

export type RuntimeEnvironment = "production" | "development" | "test";

export type ReleaseInfo = {
  service: string;
  version: string;
  revision: string;
  buildId: string;
  environment: RuntimeEnvironment;
  validVersion: boolean;
};

export type ReadReleaseOptions = {
  rootDir?: string;
  nodeEnv?: string | undefined;
  readText?: (filePath: string) => string | null;
};

function defaultReadText(filePath: string): string | null {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function parseJsonObject(raw: string | null): Record<string, unknown> | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export function isValidSemVer(value: unknown): value is string {
  return typeof value === "string" && SEMVER_PATTERN.test(value);
}

export function sanitizeReleaseIdentifier(value: unknown, fallback: string = DEFAULT_REVISION): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return RELEASE_IDENTIFIER_PATTERN.test(trimmed) ? trimmed : fallback;
}

export function normalizeEnvironment(nodeEnv: string | undefined): RuntimeEnvironment {
  if (nodeEnv === "production") return "production";
  if (nodeEnv === "test") return "test";
  return "development";
}

export function readReleaseInfo(options: ReadReleaseOptions = {}): ReleaseInfo {
  const rootDir = options.rootDir ?? process.cwd();
  const readText = options.readText ?? defaultReadText;
  const environment = normalizeEnvironment(
    Object.prototype.hasOwnProperty.call(options, "nodeEnv") ? options.nodeEnv : process.env.NODE_ENV,
  );

  const pkg = parseJsonObject(readText(resolve(rootDir, "package.json")));
  const service = sanitizeReleaseIdentifier(pkg?.name, DEFAULT_SERVICE_NAME);
  const rawVersion = typeof pkg?.version === "string" ? pkg.version.trim() : "";
  const validVersion = isValidSemVer(rawVersion);

  const rawBuildId = readText(resolve(rootDir, ".next/BUILD_ID"));
  const nextBuildId = sanitizeReleaseIdentifier(rawBuildId, DEFAULT_BUILD_ID);

  const releaseMeta = parseJsonObject(readText(resolve(rootDir, ".next/release-meta.json")));
  const revision = sanitizeReleaseIdentifier(releaseMeta?.revision, DEFAULT_REVISION);
  const buildId = sanitizeReleaseIdentifier(releaseMeta?.buildId, nextBuildId);

  return {
    service,
    version: validVersion ? rawVersion : "0.0.0-invalid",
    revision,
    buildId,
    environment,
    validVersion,
  };
}

