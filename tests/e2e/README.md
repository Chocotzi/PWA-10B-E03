# Pruebas End-to-End (`tests/e2e/`)

Responsable: Carlos Andrés Arriaga Márquez (E2E y CI, Semana 8).

El flujo crítico se prueba desde la interfaz en dos niveles. Ninguno busca texto en el código fuente:
los dos manejan la pantalla de `/inspecciones` con eventos de usuario y comprueban lo que se ve, lo que
queda en IndexedDB y lo que recibe el servidor.

| Archivo | Entorno | Comando | Servidor |
| --- | --- | --- | --- |
| `critical-inspection-flow.spec.ts` | Vitest + Testing Library + jsdom | `npm run test:e2e` (`npx vitest run tests/e2e`) | No levanta servidor: `fetch` llega al handler real de `POST /api/inspecciones` dentro del mismo proceso. |
| `critical-inspection-flow.pw.ts` | Playwright + Chromium real | `npm run build` y luego `npm run test:e2e:browser` | `playwright.config.ts` arranca `npm run start -- --port 3100` (`next start`) y espera `/inspecciones`. |

## Escenarios

| Escenario | jsdom | Chromium |
| --- | --- | --- |
| Crear → guardar sin conexión → recargar sin perderla → reconectar → una sola inspección sincronizada | ✔ (recarga = desmontar y montar; dos eventos `online` seguidos) | ✔ (recarga real servida por el service worker; reenvío de la misma operación responde 200 con el mismo acuse) |
| Respuesta perdida: el servidor aplicó pero el cliente no lo supo; el reintento no duplica | ✔ | — |
| Cámara y ubicación negadas: la pantalla lo explica y la captura se completa | ✔ (sin evidencia) | ✔ (con imagen sintética por «Elegir imagen», sin ubicación) |
| Capacidades ausentes (sin cámara, geolocalización ni procesamiento de imagen) | ✔ | — |

## Aislamiento y datos

- Solo datos sintéticos: laboratorios «Laboratorio Sintético E2E-0X» o «PW-…» y el ícono de la PWA como imagen.
- jsdom: cada caso usa una base IndexedDB nueva y un módulo nuevo del handler (servidor vacío).
- Chromium: cada caso abre un contexto nuevo (almacenamiento y service worker limpios) y un laboratorio con
  nombre único; el servidor en memoria se comparte, pero ningún caso depende de datos de otro.
- Permisos: el contexto de Playwright no concede ninguno; Chromium usa `--use-fake-device-for-media-stream`
  y el canal `chromium` para que la cámara falle por permiso negado y no por falta de soporte.

## Ejecución local

```bash
npm ci
npm run test:e2e                      # jsdom, sin navegador
npx playwright install chromium       # una vez por equipo
npm run build && npm run test:e2e:browser
```

Reportes: `test-results/e2e.xml`, `test-results/e2e-browser.xml` y `playwright-report/index.html`
(trazas y capturas en `test-results/playwright/` cuando un caso falla).
