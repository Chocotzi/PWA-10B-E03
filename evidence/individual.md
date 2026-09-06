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
Realicé la revisión de los requisitos y de la decisión de arquitectura de la Semana 1:

- Revisé `docs/requirements.md` para comprobar que los requisitos funcionales y no funcionales describen el sistema de inspecciones de laboratorio y contemplan conectividad intermitente.
- Revisé `docs/decision-record.md`, en particular la comparación entre PWA, web tradicional, app nativa y multiplataforma.
- Verifiqué en `src/lib/data/inspections.ts` que los registros mostrados son datos sintéticos y no incluyen información personal o real.
- Revisé que la pantalla principal en `src/app/page.tsx` muestre las tres inspecciones iniciales.

Enlace: revisión realizada sobre el commit `<SHA_FINAL>` del repositorio
https://github.com/Chocotzi/PWA-10B-E03
(archivos revisados: `docs/requirements.md`, `docs/decision-record.md`,
`src/lib/data/inspections.ts` y `src/app/page.tsx`).


**Una decisión que explico**

Puedo explicar la decisión de utilizar una PWA. El sistema se usará para inspecciones en laboratorios, donde puede haber conectividad limitada o intermitente. Una PWA permite conservar una sola base de código web y, en semanas posteriores, incorporar instalación desde el navegador, almacenamiento local, funcionamiento sin conexión y sincronización cuando vuelva la red.

En la Semana 1 esta decisión solo está documentada: todavía no existen service worker, manifiesto, almacenamiento local ni sincronización. El alcance actual es dejar el starter, los requisitos y la decisión técnica preparados para implementar esas funciones después.

**Comando o prueba ejecutada y resultado real**

```text
$ npm test
starter.spec.mjs: PASS
```

**Qué comprueba y qué no**

Comprueba que la prueba mínima del starter pasa y que la página inicial conserva el contenido esperado sobre inspecciones de laboratorio y datos sintéticos.
No comprueba el funcionamiento sin conexión, la instalación como PWA, el guardado de inspecciones, la sincronización de datos, la accesibilidad completa ni el comportamiento en dispositivos móviles reales.

**Una limitación**

La aplicación todavía es una versión inicial: solo visualiza tres inspecciones sintéticas. Aún no permite crear, editar o guardar inspecciones, ni operar sin conexión. Esas funciones se implementarán en las siguientes semanas.

**Uso de IA (herramienta, propósito, partes influidas, verificación humana)**

Herramienta: <ChatGPT/Codex>.
Propósito: apoyo para comprender los entregables de la Semana 1 y redactar la evidencia individual.
Partes influidas: esta sección de evidence/individual.md.
Verificación humana: revisé personalmente los documentos y archivos indicados, y ejecuté npm test para confirmar el resultado reportado.
---

## Benkis Carbajal Hernández

**Mi contribución y enlace al archivo, commit o revisión**

Revisión individual del proyecto base de la Semana 1 y validación de que el repositorio cumple con los entregables solicitados en `START_HERE.md`:

- Revisión de la estructura general del starter para confirmar que estuvieran presentes los archivos mínimos: `package.json`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/lib/data/inspections.ts`, `docs/requirements.md`, `docs/decision-record.md`, `tests/starter.spec.mjs` y `evidence/individual.md`.
- Revisión de la pantalla inicial en `src/app/page.tsx`, comprobando que corresponde al tema de inspecciones de laboratorio y que muestra datos sintéticos.
- Revisión de `src/lib/data/inspections.ts`, confirmando que los registros usados en la aplicación no contienen datos reales de personas, estudiantes o laboratorios.
- Revisión de `docs/requirements.md` y `docs/decision-record.md` para verificar que la documentación corresponde al problema planteado y a la decisión técnica de usar una PWA.
- Redacción de mi sección individual en `evidence/individual.md`, dejando evidencia de mi participación, prueba ejecutada, alcance de la prueba, limitación y uso de IA.

Enlace: commit `<pendiente>` en `https://github.com/Chocotzi/PWA-10B-E03`
(archivos revisados: `src/app/page.tsx`, `src/lib/data/inspections.ts`, `docs/requirements.md`,
`docs/decision-record.md`, `tests/starter.spec.mjs`, `evidence/individual.md`).


**Una decisión que explico**

La decisión que puedo explicar es la elección de una **PWA** para el sistema de inspecciones de laboratorio. Esta decisión es adecuada porque el problema requiere que en el futuro la aplicación pueda utilizarse en espacios donde la conexión a internet sea inestable o no esté disponible.

Una PWA permite trabajar con tecnologías web y, en etapas posteriores, agregar capacidades como instalación desde el navegador, funcionamiento sin conexión, almacenamiento local y sincronización cuando vuelva la red. Para este proyecto es una opción conveniente porque mantiene una sola base de código y se ajusta al flujo de entrega del curso mediante repositorio, URL y GitHub Actions.

Esta decisión no resuelve todavía todas las necesidades del sistema. En la Semana 1 la aplicación aún no tiene service worker, manifiesto, almacenamiento local ni sincronización de datos; por ahora solo existe el starter ejecutable con datos sintéticos y documentación inicial.

**Comando o prueba ejecutada y resultado real**
$ npm ci
added 32 packages, and audited 33 packages
found 0 vulnerabilities

$ npm run verify
Starter verificable: PASS
Reporte: {"schemaVersion": 1,"checkedAt": "2026-09-06T18:10:14.098Z","status": "pass","missing": []}

$ npm run test
starter.spec.mjs: PASS

$ npm run dev

 Local:http://localhost:3000-> se renderizan las 3 inspecciones 

**Qué comprueba y qué no**

Comprueba: que el proyecto conserva los archivos mínimos requeridos por el starter; que existe la aplicación base en src/app/; que están los documentos de la Semana 1; que existe la prueba inicial; que se genera el reporte de verificación; y que la página principal contiene el texto esperado sobre inspecciones de laboratorio y datos sintéticos.
No comprueba: que la aplicación funcione sin conexión; que pueda instalarse como PWA; que exista sincronización de inspecciones; que se puedan capturar, editar o eliminar registros; que haya almacenamiento local; ni que el comportamiento esté probado en un dispositivo móvil real.

**Una limitación**

La principal limitación es que el proyecto todavía se encuentra en una etapa inicial. La aplicación muestra únicamente datos sintéticos y no permite registrar inspecciones reales, guardar información localmente ni trabajar sin conexión. Estas funciones deberán implementarse en las siguientes semanas del curso.
Además, la verificación actual confirma la estructura mínima del starter, pero no valida todavía requisitos funcionales completos de una PWA.

**Uso de IA (herramienta, propósito, partes influidas, verificación humana)**

Herramienta: ChatGPT/Codex.
Propósito: apoyo para analizar la estructura del proyecto, entender qué solicita START_HERE.md y redactar mi sección de evidencia individual con un formato similar al resto del documento.
Partes influidas: sección de Benkis Carbajal Hernández en evidence/individual.md.
Verificación humana: revisé que la información redactada coincidiera con los archivos reales del repositorio, con el contenido del starter y con los entregables solicitados para la Semana 1. También confirmé que la evidencia no declara funcionalidades que todavía no están implementadas.
