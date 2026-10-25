// Semana 8 — E2E del flujo crítico en Chromium real (Playwright).
//
// Servidor: `next start` en el puerto 3100, levantado por playwright.config.ts (requiere `npm run build`).
// Aquí nada se simula dentro de la página: la desconexión es la del navegador (`context.setOffline`),
// la recarga es una navegación real que resuelve el service worker de la Semana 3, IndexedDB es la del
// navegador y `POST /api/inspecciones` llega al servidor de Next.js. Cada caso abre un contexto nuevo
// (almacenamiento y service worker limpios) y usa un laboratorio sintético con nombre único.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { CAMERA_MESSAGES } from "../../src/lib/device/camera";
import { LOCATION_MESSAGES } from "../../src/lib/device/geolocation";
import type { PendingMutation } from "../../src/lib/storage/schema";

type SyncPost = {
  status: number;
  kind?: string;
  revision?: string;
  sent: PendingMutation;
};

/** Registra cada POST de sincronización que la página envía y lo que el servidor respondió. */
function trackSyncPosts(page: Page): SyncPost[] {
  const posts: SyncPost[] = [];
  page.on("response", async (response) => {
    const request = response.request();
    if (request.method() !== "POST" || new URL(request.url()).pathname !== "/api/inspecciones") return;
    const body = (await response.json().catch(() => ({}))) as { kind?: string; revision?: string };
    posts.push({ status: response.status(), kind: body.kind, revision: body.revision, sent: request.postDataJSON() as PendingMutation });
  });
  return posts;
}

const notice = (page: Page) => page.getByTestId("capture-notice");
const summary = (page: Page) => page.getByText(/· \d+ pendientes · \d+ conflictos$/);
const localList = (page: Page) => page.getByRole("list", { name: "Inspecciones locales pendientes y en conflicto" });

/** La captura está lista cuando la cola local abrió (con red, además ya intentó sincronizar). */
async function expectCaptureReady(page: Page) {
  await expect(notice(page)).toHaveText(/^(Captura local lista\.|Sincronización terminada\.)$/);
}

async function fillAndSave(page: Page, lab: string) {
  await page.getByLabel("Laboratorio sintético").fill(lab);
  await page.getByLabel("Responsable sintético").fill("Técnica sintética E2E");
  await page.getByLabel("Estado").selectOption("attention");
  await page.getByLabel("Hallazgos").fill("2");
  await page.getByLabel("Resumen sintético").fill("Registro sintético del flujo crítico en Chromium.");
  await page.getByRole("button", { name: "Guardar sin conexión" }).click();
}

test.describe("E2E (Chromium) · flujo crítico de captura offline", () => {
  test("crear → guardar sin conexión → recargar sin red → reconectar → una sola inspección sincronizada", async ({ page, context, request }, testInfo) => {
    const lab = `Laboratorio Sintético PW-${testInfo.testId.slice(0, 8)}-${Date.now()}`;
    const posts = trackSyncPosts(page);
    // Los mensajes de consola del service worker llegan por el contexto, no por la página.
    const swFallbacks: string[] = [];
    context.on("console", (message) => {
      if (message.text().includes("[sw] navigation request failed")) swFallbacks.push(message.text());
    });

    // Preparación: primera visita con red. El service worker se instala, toma control y, en la
    // segunda carga, guarda /inspecciones y sus scripts para poder abrirla sin conexión.
    await page.goto("/inspecciones");
    await expectCaptureReady(page);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await page.reload();
    await expectCaptureReady(page);
    await expect(summary(page)).toHaveText("Con conexión · 0 pendientes · 0 conflictos");

    // Acción 1: se pierde la red y se guarda una inspección.
    await context.setOffline(true);
    await expect(summary(page)).toHaveText("Sin conexión · 0 pendientes · 0 conflictos");
    await fillAndSave(page, lab);
    await expect(notice(page)).toHaveText(`Inspección guardada. ${lab}: guardada sin conexión; se enviará al volver la red.`);
    await expect(localList(page).getByRole("listitem")).toHaveText([`${lab} — Pendiente de sincronizar · sin evidencia`]);

    // Acción 2: recarga real sin red. La página la entrega el service worker desde su caché y la
    // inspección vuelve a aparecer porque está en IndexedDB.
    const reloaded = await page.reload();
    expect(reloaded?.fromServiceWorker()).toBe(true);
    await expect.poll(() => swFallbacks.length).toBeGreaterThan(0); // el worker no tuvo red: usó la copia
    await expect(summary(page)).toHaveText("Sin conexión · 1 pendientes · 0 conflictos");
    await expect(localList(page).getByRole("listitem")).toHaveText([`${lab} — Pendiente de sincronizar · sin evidencia`]);
    expect(posts).toHaveLength(0);

    // Acción 3: vuelve la red. La página sincroniza sola al recibir el evento `online`.
    await context.setOffline(false);
    await expect(notice(page)).toHaveText("Sincronización completada. 1 inspección enviada al servidor.");
    await expect(localList(page)).toHaveCount(0);
    await expect(summary(page)).toHaveText("Con conexión · 0 pendientes · 0 conflictos");

    // Resultado: el servidor recibió y creó una sola inspección, la que se guardó sin conexión.
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toMatchObject({ status: 201, kind: "applied" });
    expect(posts[0].sent.inspection).toMatchObject({ location: lab, status: "attention", findings: 2 });

    // Reenviar exactamente la misma operación no crea otro registro: el servidor devuelve el mismo acuse.
    const replay = await request.post("/api/inspecciones", { data: posts[0].sent });
    expect(replay.status()).toBe(200);
    expect(await replay.json()).toEqual({ kind: "applied", revision: posts[0].revision });

    // Una recarga con red no revive pendientes ni vuelve a enviar.
    await page.reload();
    await expectCaptureReady(page);
    await expect(summary(page)).toHaveText("Con conexión · 0 pendientes · 0 conflictos");
    expect(posts).toHaveLength(1);
  });
});

test.describe("E2E (Chromium) · capacidades del dispositivo negadas", () => {
  test("con cámara y ubicación negadas, la captura se completa con una imagen sintética y sin ubicación", async ({ page, context }, testInfo) => {
    const lab = `Laboratorio Sintético PW-${testInfo.testId.slice(0, 8)}-${Date.now()}`;
    const posts = trackSyncPosts(page);

    // Preparación: el contexto no concede permisos (playwright.config.ts), como si la persona los negara.
    await page.goto("/inspecciones");
    await expectCaptureReady(page);

    await page.getByRole("button", { name: "Abrir cámara" }).click();
    await expect(page.getByTestId("photo-status")).toHaveText(CAMERA_MESSAGES.denied);
    await expect(page.getByText("La cámara está bloqueada para este sitio; «Elegir imagen» sigue disponible.")).toBeVisible();

    await page.getByRole("button", { name: "Agregar ubicación aproximada" }).click();
    await expect(page.getByTestId("location-status")).toHaveText(LOCATION_MESSAGES.denied);
    await expect(page.getByText("La ubicación está bloqueada para este sitio; puedes guardar sin ella.")).toBeVisible();

    // Alternativa: «Elegir imagen» con una imagen sintética del propio proyecto (ícono de la PWA).
    const syntheticImage = await readFile(path.join(process.cwd(), "public/icons/icon-192x192.png"));
    await page.getByLabel("Elegir imagen").setInputFiles({ name: "equipo-sintetico.png", mimeType: "image/png", buffer: syntheticImage });
    await expect(page.getByTestId("photo-status")).toHaveText(/^Foto adjunta: 192 × 192 px, \d+ KB, sin metadatos\.$/);
    await expect(page.getByRole("img", { name: "Foto de evidencia adjunta a la inspección" })).toBeVisible();

    // Se guarda sin conexión y se sincroniza al volver la red: una sola inspección, con foto y sin ubicación.
    await context.setOffline(true);
    await fillAndSave(page, lab);
    await expect(localList(page).getByRole("listitem")).toHaveText([`${lab} — Pendiente de sincronizar · con foto`]);
    await context.setOffline(false);
    await expect(notice(page)).toHaveText("Sincronización completada. 1 inspección enviada al servidor.");

    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toMatchObject({ status: 201, kind: "applied" });
    const evidence = posts[0].sent.inspection.evidence;
    expect(evidence?.photo).toMatchObject({ mimeType: "image/jpeg", width: 192, height: 192, source: "file" });
    expect(evidence?.photo?.dataUrl.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(evidence?.location).toBeUndefined();
  });
});
