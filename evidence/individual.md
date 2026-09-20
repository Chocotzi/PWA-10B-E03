# Evidencia individual — Semana 2

- **Grupo y equipo:** Aplicaciones Web Progresivas 10B — Equipo E03
- **Repositorio privado del equipo:** https://github.com/Chocotzi/PWA-10B-E03
- **SHA final (40 caracteres):** `1571f6664eab2ea16395ffa8bfac277934a66871`
  (nota: un commit no puede contener su propio hash, así que este campo registra el hash de
  su *commit padre* — el mismo patrón de Semana 1, bab3147→5003d05. **El SHA real de entrega
  de Semana 2 es el de este commit de cierre que agrega esta nota** (el mensaje de ese commit
  lo dice explícitamente), no el valor `1571f66…` escrito arriba. Para el hash exacto: es el
  commit al que apunta el tag `s02-entrega` y `git log -1 --format=%H` sobre `main`.)
- **Enlace a Actions de ese SHA:** https://github.com/Chocotzi/PWA-10B-E03/actions

> Modalidad: **equipo autorizado, evidencia individual**. Este es un solo archivo con una sección
> por integrante; cada quien redacta y responde por **su** sección. Reemplaza cada `<!-- ... -->`
> por tu respuesta y no borres los encabezados de campo.

---

## Carlos Andrés Arriaga Márquez

**SHA de mi contribución (rama dev-cleber):** `<pendiente, se llena con: git rev-parse HEAD>`

**Mi contribución y enlace al archivo, commit o revisión**

Test del manifiesto y verificación de la cobertura de CI de Semana 2:
- Creación de `tests/manifest.spec.mjs`: parsea `public/manifest.webmanifest` como JSON, valida que `name`, `start_url`, `display` y `scope` existan y no estén vacíos, que `icons` sea un arreglo con al menos 3 entradas, que cada ícono declarado exista realmente como archivo en `public/`, y que `src/app/layout.tsx` enlace el manifiesto.
- Actualización del script `test` en `package.json` para encadenar `tests/starter.spec.mjs` y `tests/manifest.spec.mjs`.
- Verificación de que `.github/workflows/week-01-starter-feedback.yml` (paso "Ejecutar pruebas") sigue cubriendo Semana 2 sin cambios, ya que corre `npm test` y este ahora ejecuta ambos specs.

Enlace: commit `<pendiente>` en `https://github.com/Chocotzi/PWA-10B-E03` (archivos: `tests/manifest.spec.mjs`, `package.json`, `evidence/individual.md`).

**Una decisión que explico**

Se decidió no usar Vitest para el test del manifiesto y mantener `node:assert/strict`, en el mismo estilo que `tests/starter.spec.mjs`. El issue de Linear (APL-6) marca explícitamente "riesgo Vitest" y no se justificaba introducir una dependencia nueva a mitad de semana solo para una prueba adicional. Esto es consistente con la decisión de Semana 1 de mantener el stack mínimo (Next.js + Node nativo, sin frameworks de testing).

**Comando o prueba ejecutada y resultado real**

```bash
$ npm test
> pwa-inspecciones-laboratorio@0.1.0 test
> node tests/starter.spec.mjs && node tests/manifest.spec.mjs

starter.spec.mjs: PASS
manifest.spec.mjs: PASS

$ npm run build
> pwa-inspecciones-laboratorio@0.1.0 build
> next build

▲ Next.js 16.3.4 (Turbopack)
✓ Compiled successfully in 43s
  Running TypeScript ...
  Finished TypeScript in 19.5s ...
  Collecting page data using 4 workers ...
  Generating static pages using 4 workers (0/3) ...
✓ Generating static pages using 4 workers (3/3) in 5.2s
  Finalizing page optimization ...

Route (app)
┌ ƒ /
└ ○ /_not-found

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

$ npm run verify
> pwa-inspecciones-laboratorio@0.1.0 verify
> node scripts/verify.mjs

Starter verificable: PASS
Reporte: reports/verification.json
```

**Qué comprueba y qué no**

- **Comprueba:** Que `public/manifest.webmanifest` tiene los campos mínimos requeridos y al menos 3 íconos, que cada ícono referenciado existe físicamente en `public/`, y que `src/app/layout.tsx` efectivamente enlaza el manifiesto; también que `npm test`, `npm run build` y `npm run verify` corren de punta a punta sin errores sobre el estado actual de `dev-cleber`.
- **No comprueba:** El contenido visual ni la validez semántica del manifiesto en un navegador real (por ejemplo, si Chrome DevTools lo acepta como instalable), el tamaño o resolución real de los archivos de ícono, ni el comportamiento de los estados `loading`/`error`/`empty` de `page.tsx`, que son responsabilidad de la Actividad 2.2.

**Una limitación**

Al revisar el trabajo de Semana 2 encontré que `src/app/page.tsx` ahora recibe `searchParams` como `Promise<{ state?: string }>` para forzar los tres estados de interfaz por query string (`?state=loading|error|empty`). Esto obliga a Next.js a tratar la ruta `/` como dinámica: en la tabla `Route (app)` del build de arriba aparece `ƒ /` en lugar de `○ /`, es decir, dejó de ser contenido estático prerenderizado. Esto contradice RNF-04 de `docs/requirements.md` ("La ruta `/` se entrega como contenido estático prerenderizado"). No corregí esto unilateralmente porque el código pertenece a la Actividad 2.2 de Benkis; lo dejo documentado como hallazgo de esta semana. Queda como pendiente de decisión de equipo para la próxima semana, ya sea aceptar el cambio de RNF-04 o revertir `page.tsx` a un Server Component estático con el manejo de estado movido al cliente (por ejemplo, leyendo `useSearchParams` en un componente cliente en vez de recibir `searchParams` como prop del servidor).

**Uso de IA (herramienta, propósito, partes influidas, verificación humana)**

- **Herramienta:** Claude Code (Anthropic), modelo Claude Sonnet 5.
- **Propósito:** Redacción de `tests/manifest.spec.mjs`, ajuste del script `test` en `package.json`, diagnóstico del cambio de renderizado estático a dinámico en `/` a partir de la salida de `npm run build`, y borrador de esta sección.
- **Partes influidas:** `tests/manifest.spec.mjs`, `package.json` (script `test`) y esta sección de `evidence/individual.md`.
- **Verificación humana:** Revisé y ejecuté yo mismo `npm test`, `npm run build` y `npm run verify` antes de commitear, y confirmé manualmente en el código de `src/app/page.tsx` que `searchParams` está tipado como `Promise<{ state?: string }>`, causa raíz del cambio de `○ /` a `ƒ /`.

**Corrección posterior (mismo día, antes del cierre de entrega)**

Tras cerrar y tagear la Semana 2 (`s02-entrega` sobre `6d4424c`), detecté un desajuste con la rúbrica oficial del profesor (`ASSIGNMENT.md` / `evaluation.json` del kit `PWA-w02-kit-estudiante.zip`): AC-02 exige literalmente que exista `tests/manifest.spec.ts`, y AC-03 corre `npm run test --if-present -- --run` sobre el workflow oficial `week-02-w02-shell-manifest.yml`. La versión anterior (`tests/manifest.spec.mjs` con `node:assert/strict`, sin ese workflow) no satisfacía ninguno de los dos. Corregí reemplazando el test por `tests/manifest.spec.ts` con Vitest (mismas verificaciones, mismo alcance, solo cambia el runner), agregué `vitest.config.ts` (con `include` restringido a `tests/**/*.spec.ts` para no tocar `tests/starter.spec.mjs`), agregué `.github/workflows/week-02-w02-shell-manifest.yml` sin modificar `week-01-starter-feedback.yml`, y actualicé `public-tests/check.sh`, `public-tests/README.md`, `ASSIGNMENT.md` y `evaluation.json` a las versiones oficiales del kit de Semana 2. El tag `s02-entrega` se movió al commit de esta corrección.

## Cleber Antonio Bolaños Moreno

**SHA de mi contribución (rama dev-cleber):** 2cd9303c038cd11c77fa1b88e5dfac9e88c67863


**Mi contribución y enlace al archivo, commit o revisión**


Configuración de la base de la PWA (Web App Manifest e íconos):
- Creación de `public/manifest.webmanifest` con los campos requeridos (`name`, `icons`, `display`, `scope`, `start_url`).
- Generación y colocación de 3 íconos en `public/icons/` (192x192, 512x512 y 512x512 maskable).
- Enlace del manifiesto y definición de `themeColor` en `src/app/layout.tsx` mediante el API de metadatos de Next.js.
- Actualización de `README.md` con las 4 secciones explícitas requeridas (setup, ejecución, verificación, evidencia).

Enlace: commit `<pendiente>` en `https://github.com/Chocotzi/PWA-10B-E03` (archivos: `public/manifest.webmanifest`, `src/app/layout.tsx`, `README.md`, `public/icons/*`).

**Una decisión que explico**

Se eligió declarar el manifiesto y el color de tema utilizando las exportaciones nativas `metadata` y `viewport` de Next.js 14+ en `layout.tsx`, en lugar de inyectar etiquetas `<link>` y `<meta>` directamente en el HTML. Esto garantiza que Next.js gestione correctamente la inyección en el `<head>` y evita problemas de hidratación, a la vez que se mantiene el manifiesto como un archivo estático en `public/` para un control total sobre su contenido.

**Comando o prueba ejecutada y resultado real**

```bash
$ npm run build
▲ Next.js 16.3.4 (Turbopack)
✓ Compiled successfully
✓ Generating static pages (3/3)
Route (app):  ○ /   ○ /_not-found   (Static) -> exit 0

$ npm run dev
# Se verificó en Chrome DevTools -> Application -> Manifest
# Resultado: Manifest válido, instalable, sin errores.
```

**Qué comprueba y qué no**

- **Comprueba:** Que el build de Next.js es exitoso sin romper la estructura de metadatos; que el navegador detecta correctamente el manifiesto, lee los íconos y habilita la opción de instalar la PWA localmente.
- **No comprueba:** El funcionamiento offline de la PWA (aún no hay Service Worker) ni la sincronización en segundo plano, ya que estas capacidades están planeadas para futuras semanas.

**Una limitación**

Dado que aún no se implementa un Service Worker con una estrategia de caché (ej. Cache First o Network First), la PWA se puede "instalar" desde el navegador, pero no cargará correctamente si el usuario se queda sin conexión después de instalarla. Chrome emite una advertencia de que la aplicación necesita un Service Worker para ser una PWA completamente funcional offline.

**Uso de IA (herramienta, propósito, partes influidas, verificación humana)**

- **Herramienta:** Gemini 3.1 Pro (High) (Google Antigravity IDE).
- **Propósito:** Generar el ícono base mediante prompts de texto, usar `sips` en bash para redimensionarlo a 192x192 y 512x512, estructurar correctamente el `manifest.webmanifest`, enlazarlo en Next.js usando `Viewport` y redactar el borrador base de este archivo de evidencias y del nuevo `README.md`.
- **Partes influidas:** `public/manifest.webmanifest`, `src/app/layout.tsx`, `README.md`, los 3 íconos autogenerados en `public/icons/` y esta sección de `evidence/individual.md`.
- **Verificación humana:** Se ejecutó `npm run build` para asegurar la compilación. Se abrió el navegador y se comprobó que **Chrome DevTools -> Application -> Manifest** muestra todos los campos sin errores y el botón "Install" aparece activo. Se leyeron las 4 secciones del README para verificar claridad y concisión.

---

## Benkis Carbajal Hernández

**Estudiante**

Benkis Carbajal Hernández

**Commit SHA evaluado**3fc35f0605004b840d79ab837134e336517bc8ea

**Decisión técnica que puedo explicar**

Elegí una estrategia de Service Worker con precache atómico, una caché versionada como
`inspecciones-v1`, limpieza de versiones antiguas durante `activate` y sin `skipWaiting`
automático. El precache usa `cache.addAll`, por lo que si falta un recurso la instalación completa
falla y no queda un App Shell a medias. Al activar una versión nueva se eliminan las cachés antiguas
solo después de que la nueva versión está lista. La nueva versión queda en `waiting` hasta que el
usuario pulsa "Actualizar"; entonces se envía `SKIP_WAITING`, ocurre `controllerchange` y se recarga
una sola vez. Así se evita activar una versión incompleta o mezclar recursos de despliegues distintos.

**Prueba que ejecuté y resultado real**

```text
npm run test -- --run
Test Files  3 passed (3)
Tests       15 passed (15)
```

La revisión manual se realizó en DevTools: se activó `Network -> Offline`, se recargó `/` y la lista
de inspecciones permaneció visible. Después se abrió una URL no cacheada y se mostró `/offline` con el
mensaje "Sin conexión". El mensaje `[sw] navigation request failed` apareció en consola durante la
simulación de red caída, como exige la observabilidad del Service Worker.

**Limitación o fallo diagnosticado**

Durante la prueba inicial, las tres pruebas del Service Worker fallaron con `Failed to parse URL
from /`. El problema estaba en el arnés de Vitest: usaba el `fetch` real de Node para rutas relativas,
en lugar del `fetchMock` del navegador simulado. Corregí el arnés para que `cache.addAll` use el
fetch simulado y después las pruebas quedaron en verde. Además, la instalación real depende de que
exista `/offline`; si esa ruta no está disponible, el precache falla de forma intencional.

**Cambio que podría defender o modificar en vivo**

Puedo subir `CACHE_VERSION` de `inspecciones-v1` a `inspecciones-v2` cuando cambien los recursos del
precache. Defendería que la caché anterior debe conservarse mientras la nueva está en `waiting` y
eliminarse únicamente en `activate`. Si se cambia network-first por cache-first para HTML, se rompe
la expectativa de que una navegación con conexión consulte primero la versión actualizada; esa
decisión se comprobaría con las pruebas de navegación offline y la revisión manual en DevTools.

**Uso declarado de IA**

- **Herramienta:** Codex.
- **Propósito:** Apoyar la implementación del Service Worker, el registro seguro en el cliente, el
  arnés determinista de Vitest, las pruebas offline y la documentación de la estrategia de caché.
- **Fragmentos influidos:** `public/sw.js`, `src/lib/pwa/register-service-worker.ts`,
  `src/components/pwa/ServiceWorkerManager.tsx`, `src/app/offline/page.tsx`,
  `tests/helpers/sw-harness.ts`, `tests/offline.spec.ts`, `tests/service-worker.spec.ts`,
  `docs/cache-strategy.md` y esta sección.
- **Validación humana:** Revisé el diff, ejecuté las pruebas automatizadas, comprobé la sintaxis del
  Service Worker, ejecuté el build y verifiqué manualmente en DevTools el modo Offline, la caché
  `inspecciones-v1`, el fallback `/offline` y el aviso de actualización.
