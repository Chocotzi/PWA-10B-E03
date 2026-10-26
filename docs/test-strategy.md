# Estrategia de Pruebas y Aseguramiento de Calidad · Semana 8

## 1. Diagnóstico Inicial de la PWA

Al retomar la PWA de la semana 6 y ejecutar las comprobaciones locales del flujo de captura offline, se diagnosticó el siguiente bloqueo crítico:

* **Fallo diagnosticado:** En el componente de captura [`src/components/inspection-capture-client.tsx`](../src/components/inspection-capture-client.tsx), la función `save(event)` ejecutaba `await queueRef.current.enqueue(...)` y posteriormente intentaba acceder a `event.currentTarget.reset()`. En React, los eventos sintéticos son reciclados o desreferenciados tras resoluciones asíncronas de promesas, lo que causaba un error en tiempo de ejecución:
  ```text
  TypeError: Cannot read properties of null (reading 'reset')
  ```
  Esto abortaba el flujo antes de que se pudiera invocar `setNotice("Inspección sintética guardada localmente.")` y `void flush()`.
* **Corrección aplicada:** Se capturó la referencia del formulario de manera síncrona al inicio del manejador de eventos: `const form = event.currentTarget;` antes de cualquier `await`. Con esto, la captura offline opera de forma determinista y sin excepciones no controladas.

---

## 2. Matriz Riesgo vs Capa de Prueba

Conforme al requerimiento AC-04 de la semana 8, se mapearon los riesgos críticos del negocio contra la capa de prueba óptima:

| Riesgo Técnico / Operativo | Capa Asignada | Archivo de Prueba | Justificación de la Capa |
| :--- | :--- | :--- | :--- |
| **1. Captura inválida:** IDs malformados, fechas no estandarizadas o campos fuera de rango. | **Unitaria** | `tests/unit/inspections-domain.spec.ts` | Las reglas de validación son funciones puras e independientes de la interfaz; la prueba unitaria ofrece retroalimentación instantánea (< 10 ms) ante cualquier entrada inválida. |
| **2. Persistencia y reconexión:** Pérdida de inspecciones capturadas sin red tras recargar el navegador. | **Integración** / **E2E** | `tests/integration/offline-persistence-and-sync.spec.ts`<br>`tests/e2e/critical-inspection-flow.spec.ts`<br>`tests/e2e/critical-inspection-flow.pw.ts` | Requiere validar que la capa de almacenamiento en IndexedDB sobreviva al cierre/reapertura de pestañas y que el estado se reconcilie en la interfaz al volver el evento `online`. La recarga real sin red (service worker + IndexedDB del navegador) solo se puede comprobar en un navegador: E2E en Chromium. |
| **3. Duplicado de sincronización:** Reenvío de una misma mutación creando múltiples registros en el servidor. | **Unitaria** & **Integración** & **E2E** | `tests/unit/queue-idempotency.spec.ts`<br>`tests/integration/offline-persistence-and-sync.spec.ts`<br>`tests/e2e/critical-inspection-flow.spec.ts`<br>`tests/e2e/critical-inspection-flow.pw.ts` | La deduplicación opera en dos frentes: la cola cliente deduplica llamadas a `flush()` compartiendo la misma promesa de drenaje, y el endpoint `/api/inspecciones` valida la clave de idempotencia (`mutation.id`). El E2E lo comprueba desde la interfaz: dos eventos `online` seguidos, respuesta perdida con reintento y reenvío de la misma operación al servidor real. |
| **4. Permisos de dispositivo no disponibles:** Bloqueo de la aplicación por cámara o GPS denegados/ausentes. | **Unitaria** & **E2E** | `tests/unit/device-capabilities.spec.ts`<br>`tests/e2e/critical-inspection-flow.spec.ts`<br>`tests/e2e/critical-inspection-flow.pw.ts` | Debe asegurarse que las funciones `captureImage` y `getCurrentLocation` retornen datos sintéticos de respaldo (*fallback*) y que el formulario permita completar el registro sin colapsar. En el E2E, la cámara y la ubicación se niegan desde la interfaz y la inspección se guarda sin esa evidencia o con una imagen sintética elegida con «Elegir imagen». |

---

## 3. Pirámide de Pruebas y Aislamiento

```
            / \
           /   \         Capa E2E (tests/e2e/)
          / E2E \        - Flujo crítico completo en UI
         /-------\       - Recarga sin conexión y reconexión
        / Integr. \      Capa de Integración (tests/integration/)
       /           \     - Persistencia IndexedDB + Endpoint con Idempotencia
      /-------------\
     /   Unitarias   \   Capa Unitaria (tests/unit/)
    /                 \  - Reglas de dominio, validaciones, cola e idempotencia
   /-------------------\
```

### 3.1. Pruebas Unitarias (`tests/unit/`)
* **Regla de validación:** Validación estricta de IDs con regex `^inspection-\d{3}$`, formato de fechas `YYYY-MM-DD`, y contratos de datos sintéticos (`inspections-domain.spec.ts`).
* **Regla de la cola e idempotencia:** Rechazo de mutaciones sin ID, deduplicación en llamadas simultáneas a `flush()`, y retención FIFO ante caídas de transporte (`queue-idempotency.spec.ts`).
* **Regla de bloqueo optimista:** Matriz de decisiones de conflicto `decideConflict` (`conflict-policy.spec.ts`).
* **Aislamiento de hardware:** Mocking de `getUserMedia` verificando `track.stop()` y stubs de geolocalización con coordenadas sintéticas de la UTT (`device-capabilities.spec.ts`).

### 3.2. Pruebas de Integración (`tests/integration/`)
* **Persistencia local:** Inserción y recuperación en IndexedDB usando `fake-indexeddb` simulando ciclos de cerrado y reapertura de la base de datos.
* **Idempotencia remota:** Reintentos múltiples de la misma mutación al endpoint `/api/inspecciones` respondiendo `200 OK` con la misma revisión aplicada en lugar de crear duplicados o conflicto `409`.

### 3.3. Pruebas End-to-End (`tests/e2e/`)

Dos niveles sobre la misma pantalla `/inspecciones`, manejada solo con acciones de usuario (detalle en `tests/e2e/README.md`):

* **jsdom (`critical-inspection-flow.spec.ts`, `npm run test:e2e`):** pantalla real con IndexedDB simulada (`fake-indexeddb`) y `fetch` dirigido al handler real de `POST /api/inspecciones` en el mismo proceso.
  * Flujo crítico: sin conexión ➔ guardar ➔ recarga (desmontar y montar; solo queda IndexedDB) ➔ dos eventos `online` seguidos ➔ una sola inspección creada en el servidor y cola local vacía.
  * Respuesta perdida: el servidor aplica pero el cliente no recibe la respuesta; tras recargar, el reintento con la misma clave recibe el mismo acuse (200) y no se crea otro registro.
  * Cámara y ubicación negadas (`NotAllowedError`, `PERMISSION_DENIED`): la pantalla lo explica, no se piden permisos al cargar y la inspección se guarda y sincroniza sin evidencia.
  * Capacidades ausentes (sin `mediaDevices`, `geolocation` ni `createImageBitmap`): la captura se completa sin bloquear la pantalla.
* **Chromium real (`critical-inspection-flow.pw.ts`, `npm run test:e2e:browser`):** build de producción servido con `next start` en el puerto 3100 (lo arranca `playwright.config.ts`).
  * Flujo crítico con desconexión real (`context.setOffline`), recarga real servida por el service worker, reconexión y una sola inspección creada; reenviar la misma operación al servidor devuelve 200 con el mismo acuse.
  * Permisos negados (el contexto no concede ninguno): la captura se completa con una imagen sintética (ícono de la PWA) y sin ubicación.
* **Aislamiento:** base IndexedDB y módulo del handler nuevos por caso (jsdom); contexto nuevo por caso y laboratorio con nombre único (Chromium).

---

## 4. Evidencia del Defecto Controlado

Para dar cumplimiento al criterio **AC-03** y demostrar que la suite de pruebas es capaz de detectar regresiones reales:

### 4.1. Introducción del Defecto
Se introdujo una modificación controlada en [`src/app/api/inspecciones/route.ts`](../src/app/api/inspecciones/route.ts) omitiendo la verificación de acuse previo (protección de idempotencia):

```typescript
// DEFECTO INTRODUCIDO: Omitir verificación de acuses previos
// const previous = acknowledgements.get(mutation.id);
// if (previous) return json(previous);
```

### 4.2. Salida Real del Fallo
Al ejecutar la prueba de integración de idempotencia, el segundo envío generó un conflicto `409` en lugar de devolver la respuesta exitosa previa:

```text
$ npx vitest run tests/integration/offline-persistence-and-sync.spec.ts

 FAIL  tests/integration/offline-persistence-and-sync.spec.ts > Integration: Offline Persistence & Duplicate-Free Sync > reintentar la sincronización de la misma operación contra el endpoint no crea un duplicado (idempotencia)
AssertionError: expected 409 to be 200 // Object.is equality

- Expected
+ Received

- 200
+ 409

 ❯ tests/integration/offline-persistence-and-sync.spec.ts:100:25
    100|     expect(res2.status).toBe(200);
       |                         ^
    101|     expect(body2.kind).toBe("applied");

 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)
```

### 4.3. Recuperación tras Restaurar la Solución
Se restauró la verificación del mapa de `acknowledgements` y la prueba pasó inmediatamente al 100%:

```text
$ npx vitest run tests/integration/offline-persistence-and-sync.spec.ts

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Duration  290ms
```

### 4.4. El mismo defecto en E2E y en CI (rama temporal `s08/defecto-controlado`)

La rama temporal tiene dos commits sobre la rama de trabajo: «DEFECTO CONTROLADO — omite la protección de duplicados» (comenta la consulta de `acknowledgements` en `POST /api/inspecciones`) y su reversión. Resultado de ejecutar el pipeline completo sobre cada commit (Node 20.20.2):

| Etapa | Con el defecto | Tras restaurar |
| :--- | :--- | :--- |
| Integración (`npm run test:integration`) | ❌ 3/4 | ✅ 4/4 |
| E2E en jsdom (`npm run test:e2e`) | ❌ 3/4 | ✅ 4/4 |
| E2E en Chromium (`npm run test:e2e:browser`) | ❌ 1/2 | ✅ 2/2 |
| Suite completa (`npm test`) | ❌ fallan esas mismas pruebas y `tests/write-endpoint.spec.ts` (Semana 5) | ✅ esas pruebas vuelven a pasar |

Salida con el defecto (extracto):

```text
FAIL  tests/e2e/critical-inspection-flow.spec.ts > E2E (jsdom) · flujo crítico de captura offline > si se pierde la respuesta del servidor, el reintento tras recargar no duplica la inspección
AssertionError: expected 'Conflicto de sincronización. 1 inspec…' to be 'Sincronización completada. 1 inspecci…'
Expected: "Sincronización completada. 1 inspección enviada al servidor."
Received: "Conflicto de sincronización. 1 inspección requiere revisión; la copia local se conservó."

✘ [chromium] › critical-inspection-flow.pw.ts › flujo crítico de captura offline › crear → guardar sin conexión → recargar sin red → reconectar → una sola inspección sincronizada
Error: expect(received).toBe(expected)
Expected: 200
Received: 409
> 102 |     expect(replay.status()).toBe(200);
```

Lectura: sin la protección, un reintento de la misma operación (respuesta perdida o reenvío) ya no recibe el acuse previo; el servidor la trata como una escritura nueva sobre una revisión vieja y responde 409, y la interfaz deja la inspección como conflicto aunque ya se había guardado.

Ejecuciones de GitHub Actions:

* Fallo (commit del defecto): PENDIENTE — pegar el enlace de la ejecución.
* Recuperación (commit de reversión): PENDIENTE — pegar el enlace de la ejecución.

---

## 5. Política de Datos Sintéticos y Privacidad

* **Sin PII ni secretos:** No se almacena información personal ni llaves de API.
* **Coordenadas fijas:** Coordenadas de prueba UTT (`18.4627, -97.3928`).
* **Imágenes sintéticas:** Imagen de 1x1 píxel en Base64 para simulación ligera.

---

## 6. Comandos de Verificación Local

```bash
# Instalación limpia y build de producción
npm ci
npm run build

# Comprobación completa: lint + tipos + artefactos + suite completa con cobertura
make verify          # sin make: npm run lint && npm run typecheck && npm run verify && npm test

# Capas por separado (cada una escribe su JUnit en test-results/)
npm run test:unit
npm run test:integration
npm run test:e2e

# E2E en Chromium real (requiere el build y, una vez, npx playwright install chromium)
npm run test:e2e:browser
```

---

## 7. Integración continua y lint

* **Workflow:** `.github/workflows/academic-evaluation.yml`, en push a cualquier rama y en PR a `main`. Etapas: `npm ci` → `npm run lint` → `npm run typecheck` → `npm run build` → `npm run verify` → unitarias → integración → E2E en jsdom → `npm test` con cobertura → E2E en Chromium. La tabla con el comando de cada etapa está en el README (Semana 8, «Pipeline de CI»).
* **Cuándo falla:** cada etapa corre si su requisito terminó bien, para ver todos los fallos en una sola ejecución; el job queda en rojo si falla cualquiera.
* **Reportes:** se publican siempre, también si falla una prueba: JUnit por capa (`test-results/`), cobertura (`coverage/`), reporte de Playwright (`playwright-report/`) y `reports/verification.json`, en el artefacto `academic-evaluation-s08-<SHA>`. La página de la ejecución resume cada etapa con su conteo de pruebas y la cobertura.
* **Línea base de lint:** se adoptó `eslint-config-next` (Next.js 16) en esta semana. Lo que ya existía y es intencional quedó como aviso en lugar de error:
  * `@next/next/no-html-link-for-pages`: los `<a href="/">` hacen una navegación completa a propósito, para que el service worker resuelva la portada y la página sin conexión.
  * `react-hooks/refs` y `react-hooks/set-state-in-effect`: son reglas pensadas para React Compiler; el proyecto usa React 18 sin compilador y esos componentes leen APIs del navegador después de montar.
  * `@typescript-eslint/no-explicit-any` en `tests/**`: los dobles de prueba simulan APIs del navegador parcialmente.
  * Cualquier error nuevo detiene el pipeline. Revisar estos avisos queda como deuda técnica registrada.
