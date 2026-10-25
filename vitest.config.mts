import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.spec.ts"],
    // Semana 6: el workflow sube `test-results/` y `coverage/` como artefactos de evidencia.
    reporters: ["default", ["junit", { outputFile: "test-results/junit.xml" }]],
    coverage: {
      enabled: true,
      provider: "v8",
      // Umbral sobre los módulos de capacidades: una regresión sin prueba hace fallar `npm test`.
      include: ["src/lib/device/**", "src/lib/notifications/**"],
      reporter: ["text-summary", "json-summary", "html"],
      reportsDirectory: "coverage",
      thresholds: { lines: 95, statements: 95, functions: 95, branches: 90 },
    },
  },
});
