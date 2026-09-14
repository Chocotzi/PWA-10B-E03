# Evidencia individual — Semana 2

- **Grupo y equipo:** Aplicaciones Web Progresivas 10B — Equipo E03
- **Repositorio privado del equipo:** https://github.com/Chocotzi/PWA-10B-E03
- **SHA final (40 caracteres):** `<pendiente, se llena con: git rev-parse HEAD>`
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

**SHA de mi contribución (rama dev-cleber):**9781e22f7896ba4b1b51d688a8ecfd4bb66db112

**Mi contribución y archivos modificados**

Implementé la pantalla principal de inspecciones y el contenedor compartido de la aplicación.

- `src/app/page.tsx`: muestra la navegación de datos y permite forzar los tres estados requeridos mediante la URL: `?state=loading`, `?state=error` y `?state=empty`.
- `src/components/app-shell.tsx`: incorpora la navegación principal y los landmarks semánticos `header`, `nav`, `main` y `footer`, además del enlace para saltar al contenido.
- `src/app/globals.css`: agrega diseño responsive, foco visible para navegación por teclado y estilos para los estados de carga, error y vacío.

**Decisión técnica propia**

Elegí forzar los estados de interfaz con el parámetro de consulta `state` en la URL, en vez de cambiar una constante del código para cada demostración. Así se pueden revisar manualmente los cuatro escenarios desde el navegador sin editar ni recompilar el proyecto: `/`, `/?state=loading`, `/?state=error` y `/?state=empty`. El parámetro se interpreta en `page.tsx` y los elementos comunes quedan aislados en `AppShell`, evitando repetir la navegación y los landmarks en futuras pantallas.

**Prueba ejecutada y resultado real**

```bash
$ node scripts/verify.mjs
Starter verificable: PASS

$ node node_modules/typescript/bin/tsc --noEmit

```

También se inició el build de Next.js: alcanzó `Compiled successfully`, pero el proceso de comprobación posterior quedó retenido por el entorno de ejecución. Por ello no se declara el build completo como prueba aprobada.

**Qué comprueba y qué no**

- **Comprueba:** Que el proyecto conserva los requisitos verificables del starter y que los archivos TypeScript modificados no presentan errores de tipos.
- **No comprueba:** Un recorrido automatizado de teclado ni una auditoría automatizada de contraste. Esas revisiones deben hacerse manualmente en el navegador con Tab y las herramientas de accesibilidad.

**Una limitación**

Los estados de carga, error y vacío son demostrativos: no dependen todavía de una solicitud real a una API. En consecuencia, el botón “Reintentar” vuelve a la vista normal, pero aún no repite una operación de red ni informa de errores de servidor reales.

**Uso de IA (herramienta, propósito, partes influidas y verificación humana)**

- **Herramienta:** Codex (GPT-5).
- **Propósito:** Apoyo para estructurar `AppShell`, proponer los estados manuales por URL y redactar estilos accesibles y responsive.
- **Partes influidas:** `src/app/page.tsx`, `src/components/app-shell.tsx`, `src/app/globals.css` y esta sección de evidencia.
- **Verificación humana:** Se revisaron los cambios y se ejecutaron `node scripts/verify.mjs` y `node node_modules/typescript/bin/tsc --noEmit`; ambos terminaron correctamente. Antes de entregar se debe revisar en el navegador el orden de Tab, los landmarks y las cuatro URLs de estado.
