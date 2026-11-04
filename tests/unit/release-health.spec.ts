import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateHealth, GET as getHealth, HEAD as headHealth } from "../../src/app/api/health/route";
import {
  DEFAULT_BUILD_ID,
  DEFAULT_REVISION,
  DEFAULT_SERVICE_NAME,
  isValidSemVer,
  normalizeEnvironment,
  readReleaseInfo,
  sanitizeReleaseIdentifier,
} from "../../src/lib/release/version";

const ROOT = resolve(__dirname, "../..");

describe("Semana 10 · Tarea 1 (Cleber) · versionado y metadatos de release", () => {
  it("valida versiones SemVer estrictas y rechaza formatos ambiguos o malformados", () => {
    for (const valid of ["0.1.0", "1.0.0", "2.4.1-rc.1", "1.0.0-alpha.2+build.7"]) {
      expect(isValidSemVer(valid), valid).toBe(true);
    }
    for (const invalid of ["", "v0.1.0", "0.1", "1.2.3.4", "latest", "0.1.0; rm -rf /", null, 100]) {
      expect(isValidSemVer(invalid), String(invalid)).toBe(false);
    }
  });

  it("sanea identificadores de revisión y build y aplica el respaldo ante entradas inválidas", () => {
    expect(sanitizeReleaseIdentifier("7dd8a97c1234")).toBe("7dd8a97c1234");
    expect(sanitizeReleaseIdentifier("  v0.1.0-rc.1  ")).toBe("v0.1.0-rc.1");
    expect(sanitizeReleaseIdentifier("")).toBe(DEFAULT_REVISION);
    expect(sanitizeReleaseIdentifier("   ")).toBe(DEFAULT_REVISION);
    expect(sanitizeReleaseIdentifier("../../etc/hosts", "respaldo")).toBe("respaldo");
    expect(sanitizeReleaseIdentifier("id con espacios")).toBe(DEFAULT_REVISION);
    expect(sanitizeReleaseIdentifier("x".repeat(65))).toBe(DEFAULT_REVISION);
    expect(sanitizeReleaseIdentifier(undefined)).toBe(DEFAULT_REVISION);
    expect(sanitizeReleaseIdentifier(42)).toBe(DEFAULT_REVISION);
  });

  it("normaliza el entorno de ejecución a valores acotados", () => {
    expect(normalizeEnvironment("production")).toBe("production");
    expect(normalizeEnvironment("test")).toBe("test");
    expect(normalizeEnvironment("development")).toBe("development");
    expect(normalizeEnvironment(undefined)).toBe("development");
    expect(normalizeEnvironment("staging-custom")).toBe("development");
  });

  it("lee la versión real del proyecto y aplica precedencia determinista de metadatos", () => {
    const real = readReleaseInfo({ rootDir: ROOT, nodeEnv: "production" });
    expect(real.service).toBe("pwa-inspecciones-laboratorio");
    expect(real.validVersion).toBe(true);
    expect(isValidSemVer(real.version)).toBe(true);
    expect(real.environment).toBe("production");

    // Con .next/release-meta.json presente: prevalece sobre .next/BUILD_ID.
    const withMeta = readReleaseInfo({
      rootDir: "/ficticio",
      nodeEnv: "production",
      readText: (path) => {
        if (path.endsWith("package.json")) return JSON.stringify({ name: "pwa-lab", version: "1.2.0" });
        if (path.endsWith("BUILD_ID")) return "build-next-abc";
        if (path.endsWith("release-meta.json")) {
          return JSON.stringify({ revision: "abc1234def56", buildId: "build-meta-99" });
        }
        return null;
      },
    });
    expect(withMeta).toEqual({
      service: "pwa-lab",
      version: "1.2.0",
      revision: "abc1234def56",
      buildId: "build-meta-99",
      environment: "production",
      validVersion: true,
    });

    // Sin release-meta.json pero con .next/BUILD_ID: usa BUILD_ID y revisión local.
    const onlyBuildId = readReleaseInfo({
      rootDir: "/ficticio",
      nodeEnv: "production",
      readText: (path) => {
        if (path.endsWith("package.json")) return JSON.stringify({ name: "pwa-lab", version: "1.2.0" });
        if (path.endsWith("BUILD_ID")) return "build-next-only\n";
        return null;
      },
    });
    expect(onlyBuildId.buildId).toBe("build-next-only");
    expect(onlyBuildId.revision).toBe(DEFAULT_REVISION);

    // Con JSON corrupto o ausente: no lanza excepción y marca versión inválida si falta package.json.
    const broken = readReleaseInfo({
      rootDir: "/ficticio",
      nodeEnv: undefined,
      readText: (path) => (path.endsWith("release-meta.json") ? "{corrupto" : null),
    });
    expect(broken).toEqual({
      service: DEFAULT_SERVICE_NAME,
      version: "0.0.0-invalid",
      revision: DEFAULT_REVISION,
      buildId: DEFAULT_BUILD_ID,
      environment: "development",
      validVersion: false,
    });
  });
});

describe("Semana 10 · Tarea 1 (Cleber) · sonda de salud /api/health", () => {
  it("GET /api/health responde 200 con versión identificable, verificaciones ok y no-store", async () => {
    const response = await getHealth(new Request("http://localhost:3000/api/health"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(body.service).toBe("pwa-inspecciones-laboratorio");
    expect(isValidSemVer(body.version)).toBe(true);
    expect(typeof body.revision).toBe("string");
    expect(typeof body.buildId).toBe("string");
    expect(body.checks).toEqual({ releaseMetadata: "ok", repository: "ok" });
  });

  it("HEAD /api/health responde 200 sin cuerpo y conserva encabezados no-store", async () => {
    const response = await headHealth(new Request("http://localhost:3000/api/health", { method: "HEAD" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("");
  });

  it("detecta un estado degradado (503) ante fallo del repositorio sin filtrar mensajes internos", async () => {
    const response = await getHealth(new Request("http://localhost:3000/api/health?simular=error"));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");

    const raw = await response.text();
    expect(raw).not.toContain("Fallo simulado del origen de datos");
    const body = JSON.parse(raw) as { status: string; checks: { releaseMetadata: string; repository: string } };
    expect(body.status).toBe("degraded");
    expect(body.checks).toEqual({ releaseMetadata: "ok", repository: "error" });
  });

  it("detecta metadatos de versión corruptos y responde 503 degraded", async () => {
    const result = await evaluateHealth({
      releaseOptions: {
        rootDir: "/ficticio",
        nodeEnv: "production",
        readText: (path) => (path.endsWith("package.json") ? JSON.stringify({ name: "pwa", version: "invalida" }) : null),
      },
    });
    expect(result.status).toBe(503);
    expect(result.payload.status).toBe("degraded");
    expect(result.payload.checks.releaseMetadata).toBe("error");
  });
});

describe("Semana 10 · Tarea 1 (Cleber) · script reproducible y contrato de contenedor", () => {
  it("write-release-meta.mjs produce salida determinista byte a byte y rechaza revisiones hostiles", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "pwa-release-meta-"));
    try {
      writeFileSync(join(tempDir, "package.json"), JSON.stringify({ name: "pwa-inspecciones-laboratorio", version: "0.1.0" }));
      mkdirSync(join(tempDir, ".next"), { recursive: true });
      writeFileSync(join(tempDir, ".next/BUILD_ID"), "build-sintetico-01\n");

      const script = resolve(ROOT, "scripts/write-release-meta.mjs");
      execFileSync(process.execPath, [script, "--root", tempDir, "--revision", "7dd8a97c0ffee"], { stdio: "pipe" });
      const firstRun = readFileSync(join(tempDir, ".next/release-meta.json"), "utf8");

      execFileSync(process.execPath, [script, "--root", tempDir, "--revision", "7dd8a97c0ffee"], { stdio: "pipe" });
      const secondRun = readFileSync(join(tempDir, ".next/release-meta.json"), "utf8");

      // Reproducibilidad exacta: dos ejecuciones sobre la misma revisión generan bytes idénticos.
      expect(firstRun).toBe(secondRun);
      expect(JSON.parse(firstRun)).toEqual({
        schemaVersion: 1,
        service: "pwa-inspecciones-laboratorio",
        version: "0.1.0",
        revision: "7dd8a97c0ffee",
        buildId: "build-sintetico-01",
      });

      // Caso negativo: una revisión con caracteres fuera de [A-Za-z0-9._-] termina con código != 0.
      expect(() =>
        execFileSync(process.execPath, [script, "--root", tempDir, "--revision", "../invalida con espacios"], {
          stdio: "pipe",
        }),
      ).toThrow();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("Dockerfile cumple invariantes de reproducibilidad, mínimo privilegio y HEALTHCHECK", () => {
    const dockerfile = readFileSync(resolve(ROOT, "Dockerfile"), "utf8");
    const nvmrc = readFileSync(resolve(ROOT, ".nvmrc"), "utf8").trim();

    // Todas las etapas parten de la misma versión mayor de Node declarada en .nvmrc y nunca usan :latest.
    const fromLines = dockerfile
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^FROM\s+/i.test(line));
    expect(fromLines.length).toBeGreaterThanOrEqual(3);
    for (const line of fromLines) {
      expect(line).toContain(`node:${nvmrc}-bookworm-slim`);
      expect(line.toLowerCase()).not.toContain(":latest");
    }

    // Instalación limpia sin scripts de terceros, usuario sin privilegios y sonda de salud contra /api/health.
    expect(dockerfile).toContain("npm ci --ignore-scripts --no-audit --no-fund");
    expect(dockerfile).toContain("npm ci --omit=dev --ignore-scripts --no-audit --no-fund");
    expect(dockerfile).toContain("scripts/write-release-meta.mjs");
    expect(dockerfile).toContain("scripts/lib/import-ts.mjs");
    expect(dockerfile).toMatch(/^USER\s+node\s*$/m);
    expect(dockerfile).toMatch(/^HEALTHCHECK\b[\s\S]*\/api\/health/m);
  });

  it(".dockerignore excluye historial git, artefactos locales y archivos sensibles del contexto", () => {
    const entries = readFileSync(resolve(ROOT, ".dockerignore"), "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));

    for (const required of [".git", "node_modules", ".next", ".env", ".env.*", "*.pem", "*.key", "credentials.json"]) {
      expect(entries, required).toContain(required);
    }
  });
});

