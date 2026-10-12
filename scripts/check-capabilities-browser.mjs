// Verificación de la Semana 6 en Chromium real (opcional; no corre en CI).
//
// Requisitos: Playwright con Chromium, sin agregarlo al proyecto:
//   npm i --no-save playwright && npx playwright install chromium
// Uso (con la app de producción, que es donde se registra el service worker):
//   npm run build && npm start            # terminal 1
//   npm run check:capabilities-browser    # terminal 2
//
// Usa dispositivos falsos de Chromium (cámara con patrón de prueba), una ubicación sintética y
// una imagen JPEG generada aquí con metadatos EXIF sintéticos. Escribe el resultado en
// reports/capabilities-browser.json y capturas en evidence/s06/.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const baseUrl = process.env.CAPABILITIES_BASE_URL ?? "http://localhost:3000";
const shotsDir = resolve(root, "evidence/s06");
const reportPath = resolve(root, "reports/capabilities-browser.json");
const SYNTHETIC_LOCATION = { latitude: 18.123456, longitude: -97.654321, accuracy: 15 };
const EXIF_MARKER = "MARCADOR-SINTETICO-EXIF";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Falta Playwright. Instálalo sin modificar package.json:");
  console.error("  npm i --no-save playwright && npx playwright install chromium");
  process.exit(2);
}

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: String(detail ?? "") });
const logs = [];

/** Inserta un segmento APP1/EXIF mínimo (ImageDescription = marcador) después del SOI de un JPEG. */
function withSyntheticExif(jpeg) {
  const text = Buffer.from(`${EXIF_MARKER}\0`, "latin1");
  const tiff = Buffer.alloc(26 + text.length);
  tiff.write("II", 0, "latin1");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4); // IFD0
  tiff.writeUInt16LE(1, 8); // una entrada
  tiff.writeUInt16LE(0x010e, 10); // ImageDescription
  tiff.writeUInt16LE(2, 12); // ASCII
  tiff.writeUInt32LE(text.length, 14);
  tiff.writeUInt32LE(26, 18); // desplazamiento del texto
  tiff.writeUInt32LE(0, 22); // sin IFD siguiente
  text.copy(tiff, 26);
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
  const header = Buffer.from([0xff, 0xe1, (payload.length + 2) >> 8, (payload.length + 2) & 0xff]);
  return Buffer.concat([jpeg.subarray(0, 2), header, payload, jpeg.subarray(2)]);
}

function spy() {
  window.__calls = { getUserMedia: 0, getCurrentPosition: 0, watchPosition: 0, requestPermission: 0 };
  window.__streams = [];
  const media = navigator.mediaDevices;
  if (media && media.getUserMedia) {
    const original = media.getUserMedia.bind(media);
    media.getUserMedia = async (constraints) => {
      window.__calls.getUserMedia++;
      window.__lastConstraints = constraints;
      const stream = await original(constraints);
      window.__streams.push(stream);
      return stream;
    };
  }
  const geo = navigator.geolocation;
  if (geo) {
    const current = geo.getCurrentPosition.bind(geo);
    const watch = geo.watchPosition.bind(geo);
    geo.getCurrentPosition = (...args) => { window.__calls.getCurrentPosition++; window.__lastGeoOptions = args[2]; return current(...args); };
    geo.watchPosition = (...args) => { window.__calls.watchPosition++; return watch(...args); };
  }
  if (window.Notification) {
    const request = Notification.requestPermission.bind(Notification);
    Notification.requestPermission = (...args) => { window.__calls.requestPermission++; return request(...args); };
  }
}

const shownNotifications = (page) => page.evaluate(async () => {
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return [];
  return (await registration.getNotifications()).map((n) => ({ title: n.title, body: n.body, tag: n.tag, url: n.data && n.data.url }));
});

const decode = (dataUrl) => Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");

async function openPage(browser, cdp, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
  await context.addInitScript(spy);
  const page = await context.newPage();
  page.on("pageerror", (error) => logs.push(`[pageerror] ${error.message}`));
  const session = await context.newCDPSession(page);
  const { targetInfo } = await session.send("Target.getTargetInfo");
  const setPermission = (name, setting) => cdp.send("Browser.setPermission", {
    permission: { name }, setting, origin: baseUrl, browserContextId: targetInfo.browserContextId,
  });
  return { context, page, setPermission };
}

await mkdir(shotsDir, { recursive: true });
await mkdir(dirname(reportPath), { recursive: true });

// --- Recorrido principal: cámara falsa con permiso automático -------------------------------
const browser = await chromium.launch({ channel: "chromium", args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
const browserCdp = await browser.newBrowserCDPSession();
const main = await openPage(browser, browserCdp, { geolocation: SYNTHETIC_LOCATION });
await main.setPermission("geolocation", "granted");
const { page } = main;

await page.goto(`${baseUrl}/inspecciones`);
await page.getByText("Sincronización terminada.").waitFor();
const workerState = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state);
check("service worker activo en producción", ["activating", "activated"].includes(workerState), workerState);
const atLoad = await page.evaluate(() => ({ ...window.__calls }));
check("al cargar no se pide cámara, ubicación ni notificaciones", Object.values(atLoad).every((count) => count === 0), JSON.stringify(atLoad));

await page.getByRole("button", { name: "Activar avisos" }).click();
await page.waitForFunction(() => window.__calls.requestPermission === 1);
check("«Activar avisos» pide permiso una sola vez", true);
await main.setPermission("notifications", "granted");
await page.reload();
await page.getByText("Sincronización terminada.").waitFor();
check("con permiso, el estado indica avisos activados", /activados/.test(await page.locator(".notification-state").textContent()));

await page.getByRole("button", { name: "Agregar ubicación aproximada" }).click();
await page.getByText("18.123, -97.654 · ±100 m").waitFor();
const geoOptions = await page.evaluate(() => window.__lastGeoOptions);
check("ubicación redondeada (18.123, -97.654 · ±100 m) sin alta precisión", geoOptions?.enableHighAccuracy === false, JSON.stringify(geoOptions));

await page.getByRole("button", { name: "Abrir cámara" }).click();
await page.waitForFunction(() => { const video = document.querySelector("video"); return video && video.videoWidth > 0; });
const constraints = await page.evaluate(() => window.__lastConstraints);
check("getUserMedia sin audio y con cámara trasera preferida", constraints?.audio === false && constraints?.video?.facingMode?.ideal === "environment", JSON.stringify(constraints));
await page.getByRole("button", { name: "Capturar foto" }).click();
await page.getByAltText("Foto de evidencia adjunta a la inspección").waitFor();
const tracksEnded = await page.evaluate(() => window.__streams.every((stream) => stream.getTracks().every((track) => track.readyState === "ended")));
check("al capturar se detienen todos los tracks de la cámara", tracksEnded);
const cameraPhoto = decode(await page.getByAltText("Foto de evidencia adjunta a la inspección").getAttribute("src"));
check("la foto de la cámara es un JPEG", cameraPhoto[0] === 0xff && cameraPhoto[1] === 0xd8, await page.getByTestId("photo-status").textContent());
await page.locator(".capture-panel").screenshot({ path: resolve(shotsDir, "captura-camara-escritorio.png") });

const canvasJpeg = decode(await page.evaluate(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 2400;
  canvas.height = 1800;
  const context = canvas.getContext("2d");
  context.fillStyle = "#28509f";
  context.fillRect(0, 0, 2400, 1800);
  context.fillStyle = "#d2dcef";
  for (let x = 0; x < 2400; x += 120) context.fillRect(x, 0, 60, 1800);
  return canvas.toDataURL("image/jpeg", 0.92);
}));
const exifJpeg = withSyntheticExif(canvasJpeg);
await page.getByRole("button", { name: "Quitar foto" }).click();
await page.setInputFiles('input[type="file"]', { name: "IMG_sintetica_con_exif.jpg", mimeType: "image/jpeg", buffer: exifJpeg });
await page.getByText(/Foto adjunta: 1280 × 960 px/).waitFor();
const stored = decode(await page.getByAltText("Foto de evidencia adjunta a la inspección").getAttribute("src"));
check("el archivo de entrada sí traía EXIF con el marcador", exifJpeg.includes(Buffer.from("Exif")) && exifJpeg.includes(Buffer.from(EXIF_MARKER)));
check("la foto guardada ya no trae EXIF ni el marcador", !stored.includes(Buffer.from("Exif")) && !stored.includes(Buffer.from(EXIF_MARKER)), `${exifJpeg.length} → ${stored.length} bytes`);

await page.getByRole("button", { name: "Guardar sin conexión" }).click();
await page.getByText("Sincronización completada. 1 inspección enviada al servidor.").waitFor();
await page.waitForTimeout(500);
const afterSave = await shownNotifications(page);
check("aviso del sistema «Inspección guardada» mediante el service worker", afterSave.some((n) => n.title === "Inspección guardada"));
check("aviso del sistema «Sincronización completada» mediante el service worker", afterSave.some((n) => n.title === "Sincronización completada"));
check("los avisos no muestran al responsable", !JSON.stringify(afterSave).includes("Técnica de prueba"));

const pageCdp = await main.context.newCDPSession(page);
const registrations = [];
pageCdp.on("ServiceWorker.workerRegistrationUpdated", (event) => registrations.push(...event.registrations));
await pageCdp.send("ServiceWorker.enable");
await page.waitForTimeout(500);
const registration = registrations.find((item) => !item.isDeleted && item.scopeURL.startsWith(baseUrl));
await pageCdp.send("ServiceWorker.deliverPushMessage", {
  origin: baseUrl,
  registrationId: registration.registrationId,
  data: JSON.stringify({ title: "Revisión pendiente", body: "Laboratorio de Redes requiere atención.", url: "https://sitio-externo.example/" }),
});
await page.waitForTimeout(800);
const push = (await shownNotifications(page)).find((n) => n.title === "Revisión pendiente");
check("un push entrante se muestra (mismo mecanismo que el botón Push de DevTools)", Boolean(push), JSON.stringify(push));
check("un push con URL externa abre /inspecciones", push?.url === "/inspecciones", push?.url);

await main.context.setOffline(true);
await page.getByRole("button", { name: "Guardar sin conexión" }).click();
await page.getByText(/guardada sin conexión; se enviará al volver la red/).waitFor();
await page.getByText(/Pendiente de sincronizar · sin evidencia/).waitFor();
await main.context.setOffline(false);
await page.getByText("Sincronización completada. 1 inspección enviada al servidor.").waitFor();
check("sin red queda pendiente y al volver la red se sincroniza con aviso", true);

await page.setViewportSize({ width: 360, height: 800 });
await page.reload();
await page.getByText("Sincronización terminada.").waitFor();
const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
check("a 360 px no hay desplazamiento horizontal", scrollWidth <= 360, `scrollWidth=${scrollWidth}`);
await page.locator(".capture-panel").screenshot({ path: resolve(shotsDir, "captura-movil-360.png") });
await browser.close();

// --- Permisos negados y diálogos sin responder ----------------------------------------------
const strict = await chromium.launch({ channel: "chromium", args: ["--use-fake-device-for-media-stream"] });
const strictCdp = await strict.newBrowserCDPSession();

const denied = await openPage(strict, strictCdp);
await denied.setPermission("geolocation", "denied");
await denied.setPermission("camera", "denied");
await denied.page.goto(`${baseUrl}/inspecciones`);
await denied.page.getByText("Sincronización terminada.").waitFor();
await denied.page.getByRole("button", { name: "Agregar ubicación aproximada" }).click();
await denied.page.getByTestId("location-status").filter({ hasText: /denegado/ }).waitFor();
check("ubicación negada: se explica y se puede guardar sin ella", true, await denied.page.getByTestId("location-status").textContent());
await denied.page.getByRole("button", { name: "Abrir cámara" }).click();
await denied.page.getByTestId("photo-status").filter({ hasText: /denegado/ }).waitFor();
check("cámara negada: se ofrece «Elegir imagen»", /Elegir imagen/.test(await denied.page.getByTestId("photo-status").textContent()));
await denied.page.locator(".capture-panel").screenshot({ path: resolve(shotsDir, "permisos-negados.png") });
await denied.page.getByRole("button", { name: "Guardar sin conexión" }).click();
await denied.page.getByText("Sincronización completada. 1 inspección enviada al servidor.").waitFor();
check("sin permisos la inspección se guarda y se sincroniza", true);

const pending = await openPage(strict, strictCdp);
await pending.page.goto(`${baseUrl}/inspecciones`);
await pending.page.getByText("Sincronización terminada.").waitFor();
await pending.page.getByRole("button", { name: "Abrir cámara" }).click();
await pending.page.getByText(/Esperando permiso de la cámara/).waitFor();
check("diálogo de cámara sin responder: «Elegir imagen» sigue habilitado", await pending.page.locator('input[type="file"]').isEnabled());
const startedAt = Date.now();
await pending.page.getByRole("button", { name: "Agregar ubicación aproximada" }).click();
await pending.page.getByTestId("location-status").filter({ hasText: /tardó demasiado/ }).waitFor({ timeout: 30_000 });
check("diálogo de ubicación sin responder: el límite propio responde «tardó demasiado»", true, `${Math.round((Date.now() - startedAt) / 1000)} s`);
const browserVersion = strict.version();
await strict.close();

const passed = results.filter((item) => item.ok).length;
const report = {
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  baseUrl,
  browser: `Chromium ${browserVersion}`,
  status: passed === results.length ? "pass" : "fail",
  passed,
  total: results.length,
  results,
  pageErrors: logs,
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
for (const item of results) console.log(`${item.ok ? "PASS" : "FAIL"}  ${item.name}${item.detail ? `  —  ${item.detail}` : ""}`);
console.log(`\n${passed}/${results.length} comprobaciones correctas. Reporte: ${reportPath}`);
process.exit(report.status === "pass" ? 0 : 1);
