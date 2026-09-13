# Evidencia individual — Semana 2

- **Grupo y equipo:** Aplicaciones Web Progresivas 10B — Equipo E03
- **Repositorio privado del equipo:** https://github.com/Chocotzi/PWA-10B-E03
- **SHA final (40 caracteres):** `<pendiente, se llena con: git rev-parse HEAD>`
- **Enlace a Actions de ese SHA:** `<pendiente: https://github.com/Chocotzi/PWA-10B-E03/actions -> corrida del SHA final>`

> Modalidad: **equipo autorizado, evidencia individual**. Este es un solo archivo con una sección
> por integrante; cada quien redacta y responde por **su** sección. Reemplaza cada `<!-- ... -->`
> por tu respuesta y no borres los encabezados de campo.

---

## Carlos Andrés Arriaga Márquez



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
