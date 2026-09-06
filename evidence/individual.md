# Evidencia individual — Semana 1

- **Grupo y equipo:** Aplicaciones Web Progresivas 10B — Equipo E03
- **Repositorio privado del equipo:** https://github.com/Chocotzi/PWA-10B-E03
- **SHA final (40 caracteres):** `<pendiente, se llena con: git rev-parse HEAD>`
- **Enlace a Actions de ese SHA:** `<pendiente: https://github.com/Chocotzi/PWA-10B-E03/actions -> corrida del SHA final>`

> Modalidad: **equipo autorizado, evidencia individual**. Este es un solo archivo con una sección
> por integrante; cada quien redacta y responde por **su** sección. Reemplaza cada `<!-- ... -->`
> por tu respuesta y no borres los encabezados de campo.

---

## Carlos Andrés Arriaga Márquez

**Mi contribución y enlace al archivo, commit o revisión**

Puesta en marcha verificable del starter y documentación de la Semana 1:

- Redacción de `docs/requirements.md` (secciones 1–6: problema y contexto, usuarios y escenarios
  —incluido el de conectividad intermitente—, RF-01…RF-10 con criterio de aceptación y estado,
  RNF-01…RNF-10 medibles, datos sintéticos y límites, y criterios de aceptación de la Semana 1).
- Redacción de `docs/decision-record.md` (ADR-001: comparación PWA / web tradicional / app nativa /
  multiplataforma, decisión, riesgos R1–R5 y validación).
- Endurecimiento del repositorio: ampliación de `.gitignore` (archivos de credenciales, artefactos
  generados, archivos de sistema operativo) y alta de `.gitattributes` (LF forzado para
  `*.sh` / `*.mjs` / `Makefile`, para que la CI en Linux no se rompa por saltos de línea de Windows).
- Ajuste de `next.config.mjs`: `agentRules: false` (Next.js 16 generaba `AGENTS.md` y `CLAUDE.md` en
  cada `next dev`) y `turbopack.root` fijado a la raíz del proyecto.
- Ejecución de la batería de verificación local y confirmación del arranque en `http://localhost:3000`.

Enlace: commit `<pendiente>` en `https://github.com/Chocotzi/PWA-10B-E03`
(archivos: `docs/requirements.md`, `docs/decision-record.md`, `.gitignore`, `.gitattributes`,
`next.config.mjs`, `evidence/individual.md`).

**Una decisión que explico**

Por qué **PWA** y no web tradicional, app nativa o multiplataforma. El requisito central es capturar
inspecciones **dentro de laboratorios sin señal** (sótano de redes, salas apantalladas) y
sincronizar cuando la red regresa:

- La **web tradicional** no ofrece operación sin conexión.
- La **app nativa** exige cuenta de desarrollador de pago y revisión de tienda, usa un stack
  (Kotlin/Java) que el equipo no domina y deja fuera el escritorio de revisión.
- La **multiplataforma** (React Native / Expo / Flutter) añade una cadena de herramientas y un
  binario nativo más que mantener en verde cada semana.
- La **PWA** cubre offline (App Shell + cola de sincronización), se distribuye y evalúa con **una
  sola URL / un repositorio** —la forma de entrega del curso—, reutiliza el stack web del equipo y
  cabe en 13 semanas.

Lo que esta decisión **no** resuelve todavía: la capa PWA (service worker, manifiesto,
almacenamiento local) no está en la Semana 1, y la sincronización en segundo plano (Background Sync)
tiene soporte desigual entre navegadores.

**Comando o prueba ejecutada y resultado real**

```
$ npm ci
added 32 packages, and audited 33 packages
found 0 vulnerabilities

$ npm run verify
Starter verificable: PASS                    -> exit 0
reports/verification.json -> { "schemaVersion": 1, "status": "pass", "missing": [] }

$ npm test
starter.spec.mjs: PASS                       -> exit 0

$ npm run build
▲ Next.js 16.3.4 (Turbopack)
✓ Compiled successfully
  Finished TypeScript in ~3 s
✓ Generating static pages (3/3)
Route (app):  ○ /   ○ /_not-found   (Static) -> exit 0

$ bash public-tests/check.sh
PUBLIC_OK                                     -> exit 0

$ npm run dev
http://localhost:3000 -> HTTP 200; se renderizan 3 inspecciones sintéticas
(Laboratorio de Redes, Electrónica y Software).
```

**Qué comprueba y qué no**

- **Comprueba:** que están los artefactos mínimos del starter; que el proyecto compila con
  TypeScript en modo `strict`; que la ruta `/` se prerenderiza como contenido estático; que el
  arranque es reproducible desde cero (`npm ci` → `npm run build` sin pasos manuales); que no hay
  archivos `.env` ni de credenciales en el árbol versionado.
- **No comprueba:** que la PWA funcione sin conexión (aún no implementada); la instalabilidad; la
  sincronización de registros; la accesibilidad real con lector de pantalla; el comportamiento en un
  teléfono real; ni que los datos de inspección sean correctos —son sintéticos de ejemplo—. El
  Escenario B (captura con conectividad intermitente) todavía no es verificable.

**Una limitación**

El check público del starter (`public-tests/check.sh`) **no bloquea de forma efectiva credenciales
versionadas**: la línea que escanea el árbol está invertida con `!` y, con `set -euo pipefail`, un
comando invertido con `!` nunca detiene el script, así que siempre imprime `PUBLIC_OK`. La
protección real en este repo es el `.gitignore` ampliado más la revisión manual del set versionado
(`git status`, `git add -n`) antes de subir. Aparte, `make` no está instalado en mi equipo; usé
`npm run verify`, que es exactamente lo que ejecutan el `Makefile` y la CI.

**Uso de IA (herramienta, propósito, partes influidas, verificación humana)**

- **Herramienta:** Claude Code (Anthropic), modelo Claude Sonnet 5.
- **Propósito:** borrador inicial de `docs/requirements.md` y `docs/decision-record.md`; propuesta de
  `.gitignore` y `.gitattributes`; diagnóstico y corrección de los dos avisos de Next.js 16;
  ejecución guiada de la batería de verificación.
- **Partes influidas:** `docs/requirements.md`, `docs/decision-record.md`, `.gitignore`,
  `.gitattributes`, `next.config.mjs` y esta sección de evidencia.
- **Verificación humana:** ejecuté localmente `npm ci`, `npm run build`, `npm run verify`,
  `npm test`, `bash public-tests/check.sh` y `npm run dev`, y contrasté cada salida con lo
  documentado; revisé el contenido de ambos documentos y la lista de archivos que se versionarían
  antes de entregar. El SHA final y el enlace de Actions se completan tras el commit.

---

## Cleber Antonio Bolaños Moreno

**Mi contribución y enlace al archivo, commit o revisión**

<!-- Qué hiciste tú específicamente + enlace al archivo, commit o revisión en el repo del equipo -->

**Una decisión que explico**

<!-- Una decisión del proyecto que entiendes a fondo y puedes defender en revisión oral -->

**Comando o prueba ejecutada y resultado real**

<!-- Comando que corriste (p. ej. npm run build, make verify, bash public-tests/check.sh) y su salida real -->

**Qué comprueba y qué no**

<!-- Alcance de esa prueba: qué garantiza y qué queda fuera -->

**Una limitación**

<!-- Algo que quedó sin resolver, un supuesto, un riesgo técnico o una duda abierta -->

**Uso de IA (herramienta, propósito, partes influidas, verificación humana)**

<!-- Herramienta: -->
<!-- Propósito: -->
<!-- Partes influidas: -->
<!-- Verificación humana: -->

---

## Benkis Carbajal Hernández

**Mi contribución y enlace al archivo, commit o revisión**

<!-- Qué hiciste tú específicamente + enlace al archivo, commit o revisión en el repo del equipo -->

**Una decisión que explico**

<!-- Una decisión del proyecto que entiendes a fondo y puedes defender en revisión oral -->

**Comando o prueba ejecutada y resultado real**

<!-- Comando que corriste (p. ej. npm run build, make verify, bash public-tests/check.sh) y su salida real -->

**Qué comprueba y qué no**

<!-- Alcance de esa prueba: qué garantiza y qué queda fuera -->

**Una limitación**

<!-- Algo que quedó sin resolver, un supuesto, un riesgo técnico o una duda abierta -->

**Uso de IA (herramienta, propósito, partes influidas, verificación humana)**

<!-- Herramienta: -->
<!-- Propósito: -->
<!-- Partes influidas: -->
<!-- Verificación humana: -->
