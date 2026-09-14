import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

async function loadManifest() {
  return JSON.parse(await readFile(resolve(root, "public/manifest.webmanifest"), "utf8"));
}

async function loadLayout() {
  return readFile(resolve(root, "src/app/layout.tsx"), "utf8");
}

describe("public/manifest.webmanifest", () => {
  it("parsea como JSON válido", async () => {
    await expect(loadManifest()).resolves.toBeTypeOf("object");
  });

  it.each(["name", "start_url", "display", "scope"])("tiene el campo %s no vacío", async (field) => {
    const manifest = await loadManifest();
    expect(manifest[field], `manifest.${field} debe existir y no estar vacío`).toBeTruthy();
  });

  it("icons es un arreglo con al menos 3 entradas", async () => {
    const manifest = await loadManifest();
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
  });

  it("cada ícono declarado existe como archivo en public/", async () => {
    const manifest = await loadManifest();
    for (const icon of manifest.icons) {
      const iconPath = resolve(root, "public", icon.src.replace(/^\//, ""));
      expect(existsSync(iconPath), `El ícono declarado ${icon.src} debe existir en public/`).toBe(true);
    }
  });
});

describe("src/app/layout.tsx", () => {
  it("enlaza el manifiesto", async () => {
    const layout = await loadLayout();
    expect(layout).toMatch(/manifest:\s*["']\/manifest\.webmanifest["']/);
  });
});
