import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(resolve(root, "public/manifest.webmanifest"), "utf8"));
const layout = await readFile(resolve(root, "src/app/layout.tsx"), "utf8");

for (const field of ["name", "start_url", "display", "scope"]) {
  assert.ok(manifest[field], `manifest.${field} debe existir y no estar vacío`);
}

assert.ok(Array.isArray(manifest.icons), "manifest.icons debe ser un arreglo");
assert.ok(manifest.icons.length >= 3, "manifest.icons debe tener al menos 3 entradas");

for (const icon of manifest.icons) {
  const iconPath = resolve(root, "public", icon.src.replace(/^\//, ""));
  assert.ok(existsSync(iconPath), `El ícono declarado ${icon.src} debe existir en public/`);
}

assert.match(layout, /manifest:\s*["']\/manifest\.webmanifest["']/);

console.log("manifest.spec.mjs: PASS");
