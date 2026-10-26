import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.spec.ts"],
    // Semana 6: JUnit y cobertura se suben como artefactos de evidencia.
    // Semana 8: cada capa escribe su propio JUnit con `--outputFile.junit=test-results/<capa>.xml`
    // (scripts test:unit, test:integration y test:e2e); la corrida completa usa junit.xml.
    reporters: ["default", "junit"],
    outputFile: { junit: "test-results/junit.xml" },
    coverage: {
      // Semana 8: la cobertura se activa solo en la corrida completa (`npm test` usa `--coverage`).
      // Así una capa ejecutada sola no falla por los umbrales, que dependen de toda la suite.
      enabled: false,
      provider: "v8",
      // El reporte cubre todo `src/` para mostrar huecos del flujo crítico (cola, almacenamiento,
      // API y componentes), no solo las capacidades del dispositivo.
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts"],
      reporter: ["text-summary", "json-summary", "html"],
      reportsDirectory: "coverage",
      // El kit pide conservar la cobertura también cuando una prueba falla.
      reportOnFailure: true,
      // Umbral de la Semana 6 sobre los módulos de capacidades: una regresión sin prueba hace fallar `npm test`.
      thresholds: {
        "src/lib/device/**": { lines: 95, statements: 95, functions: 95, branches: 90 },
        "src/lib/notifications/**": { lines: 95, statements: 95, functions: 95, branches: 90 },
      },
    },
  },
});
