import { defineConfig, devices } from "@playwright/test";

// Semana 8 — E2E en Chromium real contra el build de producción.
//
// Arranque del servidor usado por E2E: Playwright ejecuta `npm run start -- --port 3100` (next start)
// y espera a que responda /inspecciones. Requiere un build previo (`npm run build`); en CI el paso de
// build corre antes. Solo en producción se registra el service worker, necesario para recargar sin red.
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.pw.ts",
  // Un solo worker: los casos comparten el servidor en memoria (cada uno usa identificadores propios).
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  // En CI se permite un reintento; Playwright marca el caso como «flaky» en el reporte si lo necesitó.
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // Carpeta propia: Playwright la limpia al iniciar y no debe borrar los JUnit de Vitest.
  outputDir: "test-results/playwright",
  reporter: [
    ["list"],
    ["junit", { outputFile: "test-results/e2e-browser.xml" }],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Ningún permiso concedido: cámara y ubicación quedan negadas salvo que un caso diga lo contrario.
    permissions: [],
    serviceWorkers: "allow",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Chromium completo en modo headless nuevo: el "headless shell" por defecto no implementa
        // getUserMedia y respondería NotSupportedError en lugar del permiso negado.
        channel: "chromium",
        // Cámara falsa disponible pero sin aceptar el diálogo: getUserMedia termina en NotAllowedError
        // (permiso negado) y no en NotFoundError (sin cámara).
        launchOptions: { args: ["--use-fake-device-for-media-stream"] },
      },
    },
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: `${baseURL}/inspecciones`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
