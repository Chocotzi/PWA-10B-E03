# Evidencia individual · semana 9

Conserven las secciones de semanas anteriores. Cada integrante completa su bloque con resultados reales.

## Nombre: Benkis Carbajal Hernández · matrícula 3523110227

- Grupo y equipo: 10B · Equipo 03
- Commit SHA: Tarea 1 en `0c67adcdce66ea8bf60b775241676300906dff0a` (rama `dev-benkis`, integrado con la Tarea 2 en el merge `f87ceb3`). La Tarea 3 va en el commit siguiente; su SHA y el SHA final común (último run verde de `push` con las tres tareas) se entregan en Classroom, porque un commit no puede contener su propio SHA.
- Mi contribución de esta semana y enlace: Tarea 1, base y API endurecida. Creé [`src/lib/security/`](../src/lib/security/) (límites, validación estricta, utilidades HTTP y mapa acotado), endurecí [`POST /api/inspecciones`](../src/app/api/inspecciones/route.ts) y las lecturas, añadí `maxLength` al formulario de captura, redacté el borrador de [`docs/threat-model.md`](../docs/threat-model.md) y escribí las pruebas [`tests/security.spec.ts`](../tests/security.spec.ts) y [`tests/integration/api-security.spec.ts`](../tests/integration/api-security.spec.ts). Integré el kit de la semana (workflow, `public-tests/check.sh`, enunciado en `docs/actividades/w09/`) y los cinco artefactos en `scripts/verify.mjs`.
- Decisión técnica y motivo: Validación manual y estricta, sin dependencias nuevas, con rechazo de claves desconocidas (incluidas `__proto__` y `constructor`) y errores por campo que no devuelven el valor recibido. Evité una librería de esquemas para no desincronizar `package-lock.json` (causó el fallo de `npm ci` de la Semana 8). El cuerpo se lee con tope real de bytes (413 aunque `Content-Length` mienta) y las escrituras exigen `application/json` y mismo origen. Las respuestas de error son genéricas y los mapas de revisiones y confirmaciones tienen tope de 5000 entradas.
- Prueba/comando que ejecuté: `npx tsc --noEmit` sobre `src/` y sobre los dos archivos de pruebas (sin errores), y un arnés propio de Node que transpila el TypeScript y sustituye `vitest` para ejecutar `tests/security.spec.ts`, `tests/integration/api-security.spec.ts` y `tests/write-endpoint.spec.ts`. **No pude ejecutar `npx vitest run` ni `npm test` en mi entorno** (no hay acceso al registro de paquetes y los binarios nativos instalados no corresponden a este sistema).
- Resultado observado y enlace al reporte: El arnés dio 32 pruebas aprobadas y 0 fallidas (30 nuevas y 2 de `write-endpoint.spec.ts`, que conservan la idempotencia 201/200 y el conflicto 409 de la Semana 5). Al desactivar a propósito el rechazo de claves extra y el tope de bytes, 5 pruebas fallaron, lo que indica que detectan esas regresiones. El resultado oficial queda pendiente del run de GitHub Actions con `npx vitest run tests/security.spec.ts tests/integration` y `npm test`; lo anotaré aquí cuando exista.
- Qué demuestra y qué no demuestra: Demuestra que la API rechaza entradas malformadas u hostiles (tipos, longitudes, claves extra, foto no JPEG, coordenadas fuera de rango, cuerpos enormes, tipo de contenido y origen incorrectos) sin tocar el estado ni filtrar valores. No demuestra que la foto sea un JPEG real (solo se valida prefijo, base64 y tamaño), ni que el servidor de Next.js no haya almacenado ya el cuerpo antes del tope, ni protege contra abuso por frecuencia o falta de autenticación.
- Limitación o riesgo: El arnés no es Vitest; puede haber diferencias menores de comportamiento hasta que corra en CI. El endpoint sigue siendo de demostración en memoria y expulsar entradas antiguas de los mapas podría permitir que un reenvío muy tardío se trate como nuevo.
- Tarea 3 (privacidad y cierre), realizada por mí porque Cleber no respondió: creé [`src/lib/security/privacy.ts`](../src/lib/security/privacy.ts) (inventario tipado como fuente única, `redactForLog` y `purgeLocalData`), el panel [`src/components/privacy-panel.tsx`](../src/components/privacy-panel.tsx) con aviso corto y botón «Borrar datos locales» con confirmación y `aria-live`, [`docs/privacy-data-inventory.md`](../docs/privacy-data-inventory.md) con el marco legal verificado en la Cámara de Diputados y el DOF (el estatal de Puebla solo en prensa, marcado para confirmar), la versión final de [`docs/threat-model.md`](../docs/threat-model.md), la sección «Semana 9» del README, el bloque 3 de `tests/security.spec.ts` y [`tests/integration/privacy.spec.ts`](../tests/integration/privacy.spec.ts). Decisión: el inventario vive en código y una prueba lo compara con las claves que admite la validación, así que agregar un campo sin documentarlo hace fallar la suite. Resultado en mi arnés: 33/33 pruebas de `tests/security.spec.ts` y `tests/integration/privacy.spec.ts` aprobadas, incluida la pantalla de captura completa (guardar sin red → borrar → IndexedDB vacía); los dos flujos principales de `tests/e2e/critical-inspection-flow.spec.ts` siguieron pasando con el panel nuevo. Integré la Tarea 3 sobre la rama con el merge de Carlos (PR #4): resolví los conflictos de `README.md`, `docs/threat-model.md` y `tests/security.spec.ts` conservando las tres partes; con todo junto, `npm run verify` da PASS y el escáner de credenciales de Carlos da 0 hallazgos con mis archivos incluidos. Pendiente: confirmar con Vitest y CI. Limitación: IndexedDB no está cifrada y el borrado no alcanza lo ya sincronizado en el servidor.
- IA: herramienta, propósito, partes influidas y validación propia; o «no utilicé IA»: Utilicé Claude (Anthropic) para proponer el diseño de la validación y de la privacidad, redactar el código de `src/lib/security/` y del panel de privacidad, las pruebas, el inventario, el modelo de amenazas y la sección del README, y para buscar las leyes vigentes en fuentes oficiales. Revisé la lógica, comprobé el tipado con `tsc`, ejecuté las pruebas en el arnés descrito y probé que fallan al romper los controles; la ejecución oficial en Vitest y CI sigue pendiente.

## Nombre: Carlos Andrés Arriaga Márquez · matrícula 3523110609

- Grupo y equipo: 10B · Equipo 03 · Tarea 2 de la Semana 9: navegador, secretos y dependencias (T-05 a T-11).
- Commit SHA: el SHA final común se entrega en Classroom (regla del curso: no se hace un commit solo para
  escribirlo aquí). Commits de esta tarea en `dev-carlos`, sobre `dev-benkis` (`0c67adc`):
  `c45bfb8` (dependencias), `c29fcb7` (encabezados y CSP), `01364b3` (escáner de secretos), `7ae68c8` (pruebas),
  `5ac4595` (CI y Dependabot) y el commit de documentación que contiene esta sección.
- Mi contribución de esta semana y enlace:
  - Encabezados y CSP en una sola fuente, [`src/lib/security/headers.ts`](../src/lib/security/headers.ts),
    publicada por [`next.config.mjs`](../next.config.mjs) con `headers()`; HSTS solo en producción detrás de
    HTTPS; `/sw.js` con CSP propia y `no-cache`; `/api/**` con `no-store`; sin `X-Powered-By`;
    [`public/robots.txt`](../public/robots.txt).
  - Escáner de secretos: [`src/lib/security/secrets.ts`](../src/lib/security/secrets.ts) (`scanForSecrets`) y
    [`scripts/scan-secrets.mjs`](../scripts/scan-secrets.mjs) para el repositorio y para el bundle.
  - Dependencias: etapa `npm audit --omit=dev --audit-level=high`, `npm ci --ignore-scripts` y
    [`.github/dependabot.yml`](../.github/dependabot.yml). La etapa encontró `next` 16.3.4 con avisos críticos y
    lo actualicé a 16.4.3.
  - Pruebas: bloque 2 de [`tests/security.spec.ts`](../tests/security.spec.ts) (50 pruebas) y
    [`tests/e2e/security-headers.pw.ts`](../tests/e2e/security-headers.pw.ts) (3 casos en Chromium).
  - Filas T-05 a T-11 y sección 8 de [`docs/threat-model.md`](../docs/threat-model.md), sección «Semana 9» del
    [README](../README.md) y etapas nuevas del [workflow](../.github/workflows/academic-evaluation.yml).
- Decisión técnica y motivo:
  - `'unsafe-inline'` en `script-src` y no un nonce por petición. Lo probé con `next build && next start` en una
    rama local con `proxy.ts`: con nonce, `/inspecciones` y `/offline` (estáticas) perdieron 11 y 10 scripts y la
    captura no se hidrató. Forzando render dinámico las 7 rutas funcionaron, pero sin red el service worker sirvió
    tres recargas con el mismo nonce, que así ya no protege. Compensé con una CSP sin `'unsafe-eval'` en
    producción, sin dominios externos y con `connect-src` e `img-src` propios.
  - Una sola fuente para la política: Node 20 no ejecuta TypeScript, así que `next.config.mjs` y el escáner
    quitan los tipos con el compilador que ya instala el proyecto, en lugar de copiar la política en JavaScript.
  - HSTS solo si el proxy indica HTTPS (`X-Forwarded-Proto`), porque por HTTP el navegador lo ignora.
  - Umbral `high` en producción para `npm audit`. Ante un hallazgo se actualiza en una rama a la versión corregida
    y se corre el pipeline completo.
- Prueba/comando que ejecuté: en un clon limpio con Node 20.20.2 y npm 10.8.2, las mismas etapas del workflow:
  `npm ci --ignore-scripts`, `npm run audit:deps`, `npm run scan:secrets`, `npm run lint`, `npm run typecheck`,
  `npm run build`, `npm run scan:secrets -- --bundle`, `npm run verify`, las tres capas, `npm test` y
  `npm run test:e2e:browser`. Además, `npx playwright test --repeat-each=3` con `CI=1` y diez defectos
  introducidos a propósito, uno por uno.
- Resultado observado y enlace al reporte:
  - `npm test`: 274/274 (50 nuevas en `tests/security.spec.ts`); `headers.ts` y `secrets.ts` con 100 % de líneas.
  - E2E en Chromium: 5/5 (3 nuevos) y 15/15 al repetirlo tres veces; cero violaciones de CSP y de
    Permissions-Policy durante la captura y el flujo sin red.
  - Escaneo de secretos: 0 hallazgos en 116 archivos del repositorio y en 39 del bundle
    (`reports/secrets-scan.json`, `reports/secrets-scan-bundle.json`).
  - `npm audit --omit=dev`: antes 3 avisos (1 crítico, 2 altos); después de actualizar, 0
    (`reports/npm-audit.json`). Lint sin errores (los 34 avisos de la línea base no cambiaron), tipos y build sin
    errores.
  - Los diez defectos controlados (`'unsafe-eval'`, cámara abierta a todos, HSTS sin condición, worker que
    intercepta `/api`, abre URL externas o guarda `no-store`, regla JWT quitada, filtro de asignaciones quitado,
    `/sw.js` sin su CSP y `/api` sin `no-store`) hicieron fallar al menos una prueba cada uno. Con
    `microphone=(self)` falló el E2E.
  - `npm run verify` falla solo porque falta `docs/privacy-data-inventory.md`, que entrega Cleber en la Tarea 3.
  - Los reportes de CI quedan en el artefacto de cada ejecución del workflow.
- Qué demuestra y qué no demuestra:
  - Demuestra que el navegador recibe y aplica la política: un script inyectado no puede usar eval ni cargar o
    enviar nada a otro origen, la aplicación no se deja encuadrar y el micrófono queda bloqueado aunque se conceda.
    También que la captura completa y el flujo sin red funcionan con la CSP activa, que el repositorio y el
    bundle no contienen credenciales con formato conocido y que las dependencias de producción no tienen avisos
    altos ni críticos hoy.
  - No demuestra que un script en línea inyectado no corra: eso es lo que acepta `'unsafe-inline'`. Tampoco el
    comportamiento en Safari o Firefox, un HTTPS real detrás de un proxy (se simula con `X-Forwarded-Proto`), ni
    secretos sin formato reconocible o que solo queden en el historial de git.
- Limitación o riesgo:
  - El resultado de `npm audit` cambia con el tiempo aunque el commit no cambie, porque consulta avisos en línea.
  - Node 20, el de `.nvmrc`, ya no recibe parches de seguridad desde abril de 2026; propongo al equipo pasar a 22
    o 24.
  - La búsqueda por palabras de `public-tests/check.sh` falla con el propio texto del curso, así que el control
    real de secretos es el escáner por formato.
- IA: herramienta, propósito, partes influidas y validación propia:
  - Herramienta y propósito: usé Claude (Anthropic), en una sesión conectada a mi repositorio local, para revisar
    el estado de las ramas, diseñar la política y el escáner, correr el experimento del nonce, actualizar
    dependencias y generar código, pruebas y documentación.
  - Partes influidas: los archivos listados en «Mi contribución» y esta sección.
  - Validación: los resultados de arriba salieron de esa sesión, en un clon limpio con Node 20.
  - Validación propia en mi equipo (Windows, Node v24.14.0, npm 11.9.0), ya con `next` 16.4.3 instalado:
    `npm ci` instaló 500 paquetes; `npm run build` terminó sin errores; `npm run lint`, 0 errores y los 34 avisos
    de la línea base; `npm run typecheck` sin errores; `npm run scan:secrets`, PASS con 0 hallazgos en 117
    archivos; `npm test`, 274/274 en 19 archivos; `npm run test:e2e:browser`, 5/5 en Chromium. `npm run verify`
    falla solo porque falta `docs/privacy-data-inventory.md` (Tarea 3). Subí la rama con
    `git push origin dev-carlos` (`f00c76b..e267f3b`).

---

# Evidencia individual · semana 8

Conserven las secciones de semanas anteriores. Copien este bloque por cada integrante vigente del equipo y complétenlo con resultados reales.

## Nombre: Estudiante 3523110321

- Grupo y equipo: 10B · Equipo 03
- Mi contribución de esta semana y enlace: Implementé la suite de pruebas unitarias en [`tests/unit/`](../tests/unit/), documenté el diagnóstico inicial de la PWA, la matriz riesgo-prueba y la evidencia del defecto controlado en [`docs/test-strategy.md`](../docs/test-strategy.md), y corregí el bloqueo del componente de captura en [`src/components/inspection-capture-client.tsx`](../src/components/inspection-capture-client.tsx).
- Decisión técnica y motivo: Decidí aislar rigurosamente la lógica pura de dominio, reglas de validación y de la cola en entorno Node con Vitest (con `fake-indexeddb` y stubs mínimos para hardware), ejecutando 38 pruebas unitarias en < 400 ms sin depender de un navegador headless para reglas de negocio. Además, corregí el bug de pérdida de referencia en React synthetic event en el cliente de captura guardando la referencia del formulario antes de operaciones asíncronas.
- Prueba/comando que ejecuté: `npm run test:unit && npm test && npm run build && npm run verify`
- Resultado observado y enlace al reporte: 17 suites y 112 pruebas aprobadas al 100% en 1.23 segundos, build de producción exitoso sin errores de TypeScript, y verificación de artefactos en estado PASS en [`reports/verification.json`](../reports/verification.json).
- Qué demuestra y qué no demuestra: Demuestra que las reglas de negocio, validación de IDs, idempotencia de la cola y fallbacks sintéticos operan de forma determinista y que la suite detecta defectos controlados de regresión. No demuestra comportamiento visual específico de motores WebKit móviles antiguos ni rendimiento bajo miles de inspecciones simultáneas.
- Limitación o riesgo: Al usar mocks de APIs de hardware (cámara y geolocalización), no se prueban tiempos de espera reales del sensor GPS físico ni resoluciones nativas de cámara de dispositivos móviles.
- IA: herramienta, propósito, partes influidas y validación propia; o «no utilicé IA»: Utilicé Gemini para estructurar la estrategia de pruebas, documentar la matriz de riesgos y diseñar casos de prueba exhaustivos en `tests/unit/`. Validé manualmente el tipado en TypeScript, corregí el bug del componente React y ejecuté localmente cada comando.

## Estudiante: 3523110227
- Grupo y equipo: 10B · Equipo 03
- Mi contribución de esta semana y enlace: Implementación y soporte de pruebas de integración de persistencia offline y reintentos sin duplicados en [`tests/integration/offline-persistence-and-sync.spec.ts`](../tests/integration/offline-persistence-and-sync.spec.ts). El archivo ya cubría persistencia tras "recarga" (cerrar/reabrir IndexedDB) e idempotencia contra el endpoint real `POST /api/inspecciones`; añadí el tercer escenario exigido por mi rol — caída de red simulada — que faltaba específicamente dentro de `tests/integration/` (ya existía una variante equivalente en `tests/sync.spec.ts` y en `tests/unit/queue-idempotency.spec.ts`).
- Decisión técnica y motivo: Para el escenario de caída de red usé un `SyncTransport` con un contador de intentos (`attempts`): el primer `send()` lanza un error ("Network request failed") y el segundo responde `applied`. Esto ejercita el mismo contrato real que usa `createSyncQueue` en producción (el almacenamiento durable es el mecanismo de reintento, según el comentario en `src/lib/sync/queue.ts`), sin necesitar un servidor HTTP real ni temporizadores, manteniendo la prueba determinista y rápida. Verifiqué explícitamente que tras el fallo la mutación permanece en IndexedDB con `status: "pending"` y que, al reintentar, se envía y se elimina de la cola local.
- Prueba/comando que ejecuté: `npx vitest run tests/integration` (y `npm test` para la suite completa).  este comando. La prueba fue escrita siguiendo exactamente el mismo patrón (`SyncTransport` que rechaza con `mockRejectedValueOnce`/contador de intentos) que ya usan `tests/sync.spec.ts` y `tests/unit/queue-idempotency.spec.ts`, pero el resultado real de ejecución en este archivo todavía no está confirmado y debo correrlo yo mismo antes de dar esta evidencia por cerrada.
- Resultado observado y enlace al reporte: *✓ tests/integration/offline-persistence-and-sync.spec.ts (4 tests) 27ms
   ✓ Integration: Offline Persistence & Duplicate-Free Sync > persiste la inspección en almacenamiento local cuando se guarda sin conexión 9ms
   ✓ Integration: Offline Persistence & Duplicate-Free Sync > reintentar la sincronización de la misma operación contra el endpoint no crea un duplicado (idempotencia) 8ms
   ✓ Integration: Offline Persistence & Duplicate-Free Sync > controla las respuestas remotas con fixtures de conflicto y fallo de red 4ms
   ✓ Integration: Offline Persistence & Duplicate-Free Sync > retiene la mutación como pending ante una caída de red simulada y la envía al reintentar 5ms

 - Test Files  1 passed (1)
      Tests  4 passed (4) de `npx vitest run tests/integration` (número de pruebas pasadas/fallidas) y, si aplica, el reporte de [`reports/verification.json`](../reports/verification.json) o el run del workflow de CI (`.github/workflows/academic-evaluation.yml`, job "AC-03 - Pruebas de Integración"). 
- Qué demuestra y qué no demuestra: Demuestra que una inspección guardada sin conexión sobrevive a cerrar y reabrir el almacenamiento local (IndexedDB vía `fake-indexeddb`), que reenviar la misma mutación al endpoint real no crea duplicados ni conflictos falsos (idempotencia por `mutation.id`), y que una caída de red deja la mutación retenida como `pending` para reintento en vez de perderla o aplicarla parcialmente. No demuestra el comportamiento de IndexedDB en un navegador real (cuotas de almacenamiento, múltiples pestañas concurrentes, eventos `versionchange` reales), ni la renderización visual del formulario de captura en pantalla, ni latencia de red real (el fallo se simula con una promesa rechazada, no con una desconexión de socket real).
- Limitación o riesgo: El endpoint `/api/inspecciones` es una implementación de demostración en memoria (`Map` en el proceso del servidor), por lo que la idempotencia probada aquí no sobrevive a un reinicio del servidor ni se replica entre instancias; en un backend real se necesitaría una tabla de deduplicación persistente. Además, `fake-indexeddb` no reproduce con exactitud los límites de cuota ni la concurrencia entre pestañas de un navegador real.
- IA: herramienta, propósito, partes influidas y validación propia; o «no utilicé IA»: Usé Claude para analizar la arquitectura del repositorio, identificar que faltaba el escenario de caída de red dentro de `tests/integration/` y redactar la prueba siguiendo el estilo ya usado en el archivo. Revisé y entiendo la prueba generada (el patrón de `SyncTransport` con contador de intentos, las aserciones sobre `storage.list()` y los valores de `flush()`).

## Nombre: Carlos Andrés Arriaga Márquez (matrícula 3523110609)

- Grupo y equipo: 10B · Equipo 03 · líder de la Semana 8; responsable de E2E, pipeline de CI y README.
- Mi contribución de esta semana y enlace:
  - Integré `main` (Semana 6) en la rama de trabajo, que había nacido antes del PR #2, y resolví los conflictos de `README.md`, `inspection-capture-client.tsx`, `.gitignore` y esta evidencia (commit `b75a6e5`).
  - Escribí el E2E del flujo crítico en jsdom ([`tests/e2e/critical-inspection-flow.spec.ts`](../tests/e2e/critical-inspection-flow.spec.ts), `34bfb13`).
  - Escribí el E2E en Chromium real ([`tests/e2e/critical-inspection-flow.pw.ts`](../tests/e2e/critical-inspection-flow.pw.ts) y [`playwright.config.ts`](../playwright.config.ts), `332b7d3`).
  - Configuré lint, comprobación de tipos y pruebas por capa con JUnit y cobertura ([`eslint.config.mjs`](../eslint.config.mjs), [`vitest.config.mts`](../vitest.config.mts), `c5cb67c`).
  - Rehice el workflow ([`.github/workflows/academic-evaluation.yml`](../.github/workflows/academic-evaluation.yml)), su resumen ([`scripts/ci-summary.mjs`](../scripts/ci-summary.mjs)) y `make verify` (`ebfad71`).
  - Actualicé el [README](../README.md) y las secciones de E2E, defecto controlado y CI de [`docs/test-strategy.md`](../docs/test-strategy.md).
- Decisión técnica y motivo: probé el flujo crítico en dos niveles.
  - En jsdom, la pantalla real usa el handler real de `POST /api/inspecciones` en el mismo proceso. Es rápido y permite casos difíciles de provocar en un navegador, como la respuesta perdida tras aplicarse en el servidor.
  - En Chromium contra `next start`, la recarga sin red solo es real con el service worker y la IndexedDB del navegador, y el kit pide documentar el servidor del E2E.
  - Además, la cobertura se mide solo en la suite completa: con el umbral global de la Semana 6, cualquier capa ejecutada sola fallaba aunque sus pruebas pasaran.
- Prueba/comando que ejecuté: `npx vitest run tests/e2e && npm run build`; además `npm run test:e2e:browser` y el pipeline completo en un clon limpio con Node 20 (los mismos comandos del workflow).
- Resultado observado y enlace al reporte:
  - E2E en jsdom: 4/4 (`test-results/e2e.xml`). `npm run build` terminó sin errores.
  - E2E en Chromium: 2/2 (`test-results/e2e-browser.xml`, `playwright-report/`), y 10/10 al repetirlo cinco veces.
  - Con defectos introducidos a propósito, el E2E en jsdom falló en los cinco casos y el de Chromium en los tres que probé: quitar la protección de duplicados, la persistencia o la sincronización al volver la red; en jsdom también dos `flush` en paralelo y el `currentTarget` de la Semana 5.
  - El defecto controlado y su reversión están en `docs/test-strategy.md` §4.4. Los reportes de CI quedan en el artefacto `academic-evaluation-s08-<SHA>` de cada ejecución.
- Qué demuestra y qué no demuestra:
  - Demuestra que, desde la interfaz, una inspección guardada sin red sobrevive a una recarga real sin red y se sincroniza una sola vez al volver la conexión. También que reenviar la misma operación no crea otro registro y que negar cámara y ubicación no impide completar la captura.
  - No demuestra Safari, Firefox ni iOS, varias pestañas a la vez, un servidor persistente o con varias instancias, sensores físicos ni rendimiento con muchas inspecciones. El nivel jsdom no ejecuta el service worker.
- Limitación o riesgo:
  - `npm run typecheck` no revisa `tests/`.
  - El lint quedó con avisos de línea base (`docs/test-strategy.md` §7).
  - El E2E en Chromium depende del build y descarga el navegador en CI.
  - Al integrar `main`, las 8 pruebas de `tests/unit/device-capabilities.spec.ts` quedaron llamando funciones que la Semana 6 reemplazó; el pipeline lo detecta en la etapa de unitarias (corrección a cargo de Cleber).
- IA: herramienta, propósito, partes influidas y validación propia:
  - Herramienta y propósito: usé Claude (Anthropic) en una sesión con un clon del repositorio para analizar las ramas, diagnosticar el merge con `main`, diseñar las pruebas y generar el código y la documentación.
  - Partes influidas: los archivos listados en «Mi contribución» y esta sección.
  - Validación propia: revisé el diff de cada commit antes de subirlo y ejecuté en mi equipo `npm ci`, `npx vitest run tests/e2e`, `npm run build` y `npm run test:e2e:browser`, con este resultado: 4/4 en jsdom (npx vitest run tests/e2e), npm run build sin errores (Next.js 16.3.4) y 2/2 en Chromium (npm run test:e2e:browser), en Windows con Node v24.14.0.

El SHA final común se entrega en Classroom tras el último commit. No inserten ese SHA en un nuevo commit para intentar identificar el mismo archivo.

---

## Histórico de Semanas Anteriores

### Estudiante: 3523110321 — Semana 6

- Decisión técnica que puedo explicar: Implementé un "fallback" con datos sintéticos para las capacidades de la cámara y la geolocalización. La decisión principal fue devolver una promesa exitosa aunque el dispositivo no cuente con las APIs, retornando coordenadas estáticas y una imagen en base64 de 1x1 píxel.
- Prueba que ejecuté y resultado: Ejecuté `npm test` verificando con `vitest` que las funciones `captureImage` y `getCurrentLocation` devuelven éxito (success: true) y la información sintética esperada incluso simulando la ausencia del objeto global `navigator.mediaDevices` o `navigator.geolocation`. Todas las pruebas pasaron con éxito.
- Limitación o fallo diagnosticado: Al depender de datos estáticos en el fallback, los reportes en dispositivos sin GPS parecerán haber sido emitidos desde el mismo lugar geográfico siempre (UTT), lo cual falsearía los análisis espaciales si no consideramos un atributo como "useSynthetic". 
- Cambio que podría defender o modificar en vivo: Podría mostrar cómo capturar parámetros en la configuración para hacer las coordenadas más aleatorias, o cómo invocar `stream.getTracks().forEach(track => track.stop())` para no dejar la cámara encendida consumiendo recursos.
- Uso declarado de IA (herramienta, propósito, validación): Usé Gemini para dividir la carga de trabajo entre módulos independientes, estructurar los archivos `camera.ts` y `geolocation.ts` y documentar mi parte. Yo revisé y entiendo el código generado sobre los fallbacks.

### Benkis Carbajal Hernández — Semana 6

**Contribución:** Implementé `src/lib/notifications/client.ts` para detectar soporte, solicitar permiso
y mostrar notificaciones locales con datos sintéticos. Añadí pruebas reproducibles en
`tests/notifications.spec.ts` y documenté setup, límites y verificación.

**Decisión técnica:** La solicitud de permiso queda encapsulada y solo ocurre cuando la interfaz la llama
explícitamente; en entornos sin `Notification` se devuelve `unsupported` sin romper la aplicación.

**Prueba:** Pendiente de ejecutar en CI junto con `npm ci`, `make verify`, `npm test` y `npm run build`.

**Limitación:** Esto cubre notificaciones locales, no Push/Web Push ni entrega desde un backend.

**Uso de IA:** Codex apoyó la implementación, las pruebas y la documentación; revisé los archivos y los
casos sintéticos antes de integrarlos.

### Carlos Andrés Arriaga Márquez — Semana 6

- **Estudiante:** Carlos Andrés Arriaga Márquez
- **Rama:** `dev-carlos`, creada desde `dev-cleber` (`b37c1e7`) para conservar la Semana 5 y la primera versión de la Semana 6.
- **Commit SHA evaluado:** `fe40dd70101dea519e3136d86a094d36506d1faa` (contenido completo de la entrega; el commit siguiente solo registra este SHA).
- **Commits relevantes:** `cbc9da981661e349d436e9e0e8e03e7540dd389d` (implementación, integración y pruebas) y `fe40dd70101dea519e3136d86a094d36506d1faa` (documentación, README y comprobación en Chromium).

**Contribución.** Integré la evidencia opcional (foto y ubicación aproximada) y los avisos de cambio al
formulario de captura de la Semana 5. Reescribí `src/lib/device/camera.ts` y `src/lib/device/geolocation.ts`,
amplié `src/lib/notifications/client.ts` conservando las funciones de Benkis, agregué `push` y
`notificationclick` a `public/sw.js`, 74 pruebas en `tests/capabilities.spec.ts` con umbral de cobertura y
reporte JUnit, la comprobación en Chromium (`scripts/check-capabilities-browser.mjs`), `docs/capabilities.md` y
restauré el README, que había quedado reemplazado por el texto del kit.

**Decisión técnica que puedo explicar.** Cuando falta la API o se niega el permiso, la inspección se guarda
**sin** esa evidencia y la pantalla lo explica; no se inventan coordenadas ni imágenes. La primera versión
devolvía la ubicación de la universidad y una imagen de 1 × 1 px como `success: true`, lo que mezcla datos
inventados con medidos y no permite distinguir una inspección real. Los datos sintéticos quedan en las pruebas
(dobles inyectados) y en las demostraciones (DevTools → Sensors, imagen sintética). Además, cada permiso se pide
solo con su botón, la foto se vuelve a codificar para quitar EXIF/GPS y la ubicación se redondea a ≈ 110 m.

**Prueba que ejecuté y resultado.** `npm ci`; `npm run verify` → `Starter verificable: PASS`; `npm test` →
9 archivos y 139 pruebas aprobadas, cobertura de `src/lib/device` y `src/lib/notifications` de 100 % en líneas y
funciones y 97.24 % en ramas; `npm run build` sin errores; `bash public-tests/check.sh` → `PUBLIC_OK`;
`npm run check:capabilities-browser` → 22/22 en Chromium 141 (`reports/capabilities-browser.json`).

**Limitación o fallo diagnosticado.** El formulario de la Semana 5 llamaba `event.currentTarget.reset()`
después de un `await`; React limpia `currentTarget` al terminar el despacho y se lanzaba
`TypeError: Cannot read properties of null (reading 'reset')`. La inspección quedaba en IndexedDB, pero no se
reiniciaba el formulario, no se actualizaba la lista y no se sincronizaba hasta recargar. Lo reproduje con una
prueba, guardé la referencia al formulario antes del primer `await` y dejé la prueba de regresión en CAP-06.
Limitación vigente: no hay suscripción Web Push ni servidor de envío (requiere claves VAPID fuera del
repositorio); el worker sí muestra un push entrante.

**Cambio que podría defender o modificar en vivo.** Cambiar `LOCATION_DECIMALS` de 3 a 2 (≈ 1.1 km) y mostrar qué
prueba falla; ajustar `PHOTO_MAX_DIMENSION` o el tope de 1 MB; o enviar un push desde DevTools → Application →
Service workers → Push y explicar por qué una URL externa se reemplaza por `/inspecciones`.

**Uso declarado de IA.**

- **Herramienta:** Claude (Anthropic), en una sesión conectada a mi repositorio local.
- **Propósito:** revisar el estado de las ramas, proponer el diseño y generar código, pruebas, documentación y la
  comprobación en Chromium.
- **Partes influidas:** los archivos de la tabla «Qué se agregó» de la Semana 6 en el README,
  `tests/helpers/sw-harness.ts`, `src/components/inspection-capture-client.tsx` y esta sección.
- **Validación humana:** revisé el diff completo antes de cada commit, ejecuté `npm ci`, `npm run verify`,
  `npm test` y `npm run build` en mi equipo y probé en Chrome los pasos de la sección 8 de `docs/capabilities.md`.
