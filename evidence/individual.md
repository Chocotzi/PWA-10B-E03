# Evidencia individual — Semana 3

- **Grupo y equipo:** Aplicaciones Web Progresivas 10B — Equipo E03
- **Repositorio privado del equipo:** https://github.com/Chocotzi/PWA-10B-E03
- **SHA final (40 caracteres):** `<pendiente>`
  (nota: un commit no puede contener su propio hash, así que este campo se llena después del
  commit de cierre con el SHA del commit al que apunta el tag `s03-entrega`, que se obtiene con
  `git log -1 --format=%H` sobre `main`.)
- **Enlace a Actions de ese SHA:** https://github.com/Chocotzi/PWA-10B-E03/actions

> Modalidad: **equipo autorizado, evidencia individual**. Este es un solo archivo con una sección
> por integrante; cada quien redacta y responde por **su** sección. Reemplaza cada `<!-- ... -->`
> por tu respuesta y no borres los encabezados de campo.

---

## Carlos Andrés Arriaga Márquez

**Estudiante**

Carlos Andrés Arriaga Márquez

**Commit SHA evaluado**

`d9faaac9319a5722ee8a136b504e59c2e10b8fed`, salida de `git log -1 --format=%H` antes de commitear.
Es el commit de Benkis sobre el que construí mi trabajo. Un commit no puede contener su propio hash,
igual que en las semanas 1 y 2: mis cambios (pruebas, arnés, README y esta sección) van en el commit
de cierre al que apunta el tag `s03-entrega`.

**Decisión técnica que puedo explicar**

Probé el Service Worker ejecutando el `public/sw.js` real, sin modificarlo, dentro de `node:vm` con un
`self`, un `caches` y un `fetch` simulados (`tests/helpers/sw-harness.ts`), en lugar de abrir un
navegador real con Playwright o Puppeteer. Lo elegí por tres razones:

- **Determinismo.** La red es una función que controlo (`goOffline()`, `respond()`), así que no hay
  esperas, reintentos ni pruebas intermitentes.
- **Sin servicios nuevos.** No se instala ningún navegador ni se levanta `next start`; el workflow de
  CI solo necesita `npm ci`.
- **Velocidad.** Las 39 pruebas tardan unos 4 segundos en mi equipo.

Como el archivo que se prueba es el mismo que se sirve, romper una regla del worker rompe una prueba.
El costo es que la simulación no es un navegador, por eso la revisión manual en DevTools que describe
el README sigue siendo necesaria.

**Prueba que ejecuté y resultado real**

Completé `tests/service-worker.spec.ts` hasta los 11 casos del contrato y `tests/offline.spec.ts`
hasta los 8: 5 del registro y 3 de consulta offline de extremo a extremo. Antes de mi trabajo la
suite tenía 15 pruebas (3 del worker, 4 de registro y 8 del manifest); ahora tiene 39.

```text
$ npm run test -- --run

> pwa-inspecciones-laboratorio@0.1.0 test
> node tests/starter.spec.mjs && vitest run --run

starter.spec.mjs: PASS

 RUN  v3.2.7 C:/Users/carly/OneDrive/Desktop/PWA-inspecciones-arriaga-marquez-carlos-andres

 ✓ tests/manifest.spec.ts (8 tests) 13ms
 ✓ tests/offline.spec.ts (10 tests) 22ms
 ✓ tests/service-worker.spec.ts (21 tests) 58ms

 Test Files  3 passed (3)
      Tests  39 passed (39)
   Start at  23:27:30
   Duration  4.16s (transform 238ms, setup 0ms, collect 1.39s, tests 93ms, environment 1ms, prepare 4.20s)
```

`npm run build` termina sin errores y muestra `/offline` como ruta estática:

```text
Route (app)
┌ ƒ /
├ ○ /_not-found
└ ○ /offline
```

Para comprobar que las pruebas detectan regresiones hice una prueba de mutación manual. Con un script
temporal, que no está en el repositorio, rompí `public/sw.js` y `register-service-worker.ts` de 34
maneras distintas, una regla cada vez: por ejemplo, quitar la comprobación de `no-store` o volver
cache-first la navegación. En las 34 falló la prueba del caso correspondiente. Después restauré los
archivos y `git diff` de ambos quedó vacío.

**Limitación o fallo diagnosticado**

Al escribir el caso 2 (la instalación debe fallar completa si un recurso del precache responde
error), las tres pruebas fallaron contra el arnés original:

```text
× la instalación falla completa si un recurso del precache responde 500
  → / no debe quedar guardado tras una instalación fallida: expected Response { status: 200, ... } to be undefined
```

El fallo no estaba en `public/sw.js`, porque `install` sí rechazaba: pasó la aserción `rejects.toThrow()`.
Estaba en el arnés. Su `cache.addAll` guardaba cada respuesta en cuanto llegaba, así que cuando
`/offline` fallaba, `/` y los demás recursos ya estaban guardados. El `Cache.addAll` real es atómico:
obtiene todas las respuestas y solo las guarda si todas son correctas. Corregí el arnés para obtener
primero todo y guardar después, y las tres pruebas pasaron. Con el arnés original no se podía
distinguir una instalación atómica de una parcial, aunque el título de la prueba existente decía
"atómica".

Segundo hallazgo, que no corregí porque el código es de Benkis y la decisión es del equipo. Con
`npm start` y `curl -I`, la ruta `/` responde
`Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`, porque es dinámica desde la
Semana 2 (el pendiente de RNF-04). Como el worker no guarda respuestas `no-store`, la copia offline de
`/` es la que se tomó al instalar y no se actualiza al navegar con red. Mis pruebas simuladas no lo
detectan porque su respuesta simulada no trae ese encabezado. Lo comprobé en los encabezados del
servidor, no en un navegador. Queda una decisión de equipo: volver `/` estática o ajustar la regla.

**Cambio que podría defender en vivo**

Cambiar en `public/sw.js` la estrategia de navegación de network-first a cache-first: en el listener
`fetch`, sustituir `networkFirstNavigation(request)` por `cacheFirst(request)`. Con ese cambio fallan
5 pruebas: la que exige responder la red y actualizar la copia, la del respaldo `/offline` sin copia,
la del registro de errores de navegación y dos de consulta offline de extremo a extremo. Lo defendería
como un error, porque las inspecciones cambian y con cache-first el coordinador vería datos viejos
aunque tenga conexión. Revertir el cambio devuelve la suite a verde.

**Uso declarado de IA**

- **Herramienta:** Claude Code (Anthropic). Claude Fable 5.1 preparó la infraestructura de la semana
  (workflow, check público, `verify.mjs` y esqueletos). Claude Sonnet 5 integró la rama de Benkis,
  amplió las pruebas, escribió la sección del README y redactó esta sección.
- **Propósito:** Completar las suites de pruebas hasta el contrato, ampliar el arnés de simulación,
  hacer la prueba de mutación, comprobar los encabezados reales de la ruta `/` y redactar la
  documentación de la semana.
- **Fragmentos influidos:** `tests/service-worker.spec.ts`, `tests/offline.spec.ts`,
  `tests/helpers/sw-harness.ts`, `README.md`, `.github/workflows/week-03-w03-service-worker-offline.yml`,
  `public-tests/check.sh`, `public-tests/README.md`, `scripts/verify.mjs` y esta sección. El contenido
  final de `public/sw.js`, `register-service-worker.ts`, `ServiceWorkerManager.tsx` y `/offline` es de
  Benkis; la IA no lo escribió.
- **Validación humana:** Claude Code ejecutó los comandos, la prueba de mutación y la comprobación de
  encabezados en mi equipo. Antes de commitear reviso el diff completo y repito
  `npm run test -- --run` y `npm run build`.

**Nota sobre la contribución del equipo en S3**

La implementación técnica de esta semana (service worker, registro en cliente, página
offline y las pruebas ampliadas) fue realizada por Benkis Carbajal y por mí; Cleber
Bolaños no tuvo una contribución de código verificable en el repositorio para S3 y su
sección de evidencia individual corresponde a la Semana 2. Lo dejamos así antes que
declarar una contribución que no ocurrió.

## Cleber Antonio Bolaños Moreno

**SHA de mi contribución — Semana 2 (rama dev-cleber):** 2cd9303c038cd11c77fa1b88e5dfac9e88c67863


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

**Commit SHA evaluado**d9faaac9319a5722ee8a136b504e59c2e10b8fed

Nota: `d9faaac…` es el commit de mi contribución en `dev-benkis`. Un commit no puede contener su
propio hash, igual que en las semanas 1 y 2, así que el SHA de entrega es el del commit de cierre
al que apunta el tag `s03-entrega`, que tiene este commit como ancestro.

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
Tests       39 passed (39)
```

Desglose por archivo: `manifest` 8, `offline` 10 y `service-worker` 21 pruebas.

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
