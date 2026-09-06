# Requisitos del producto — completar en Semana 1

- **Proyecto:** PWA de inspecciones de mantenimiento de laboratorios — Universidad Tecnológica de Tehuacán.
- **Materia:** Aplicaciones Web Progresivas. Proyecto acumulativo, semanas 1–13.
- **Modalidad:** equipo autorizado de 3 personas (Arriaga, Bolaños, Carbajal); repositorio y evidencia individuales.
- **Fecha de esta versión:** 2026-09-06.
- **Datos:** exclusivamente sintéticos. Queda prohibido cualquier dato real de personas, laboratorios o activos.

## 1. Problema y contexto

La coordinación de laboratorios de la universidad realiza inspecciones periódicas de mantenimiento
(estado de equipos, instalaciones eléctricas, ventilación, señalización y seguridad) en los
laboratorios de cómputo, redes, electrónica y afines. Hoy ese registro se hace en papel o en hojas
de cálculo sueltas y se transcribe después. Esto genera tres problemas observables:

1. **Latencia y pérdida de información.** Entre la visita y la captura pasan horas o días; algunas
   notas se pierden o quedan ilegibles.
2. **Baja trazabilidad.** No hay un historial consultable por laboratorio ni un estado claro de
   "requiere atención / sin incidencias" ni seguimiento de hallazgos.
3. **Trabajo en sitios con mala conectividad.** Varios laboratorios (sótano de redes, salas
   apantalladas, talleres) tienen señal Wi‑Fi o celular intermitente o nula, justo donde se
   necesita capturar la inspección.

**Objetivo del producto.** Una aplicación web progresiva, usable desde un teléfono, que permita
registrar y consultar inspecciones de mantenimiento, que funcione durante cortes de conectividad y
que sincronice los registros cuando la red regrese, de forma reproducible y sin datos personales.

**Contexto de conectividad.** Uso principal en movilidad dentro del campus: de "buena conexión"
(oficina de coordinación) a "sin conexión" (interior de laboratorios). Se asume un dispositivo
Android de gama media con navegador Chrome actualizado y un equipo de escritorio para revisión.

**Fuera de alcance.**

- Semana 1: todavía **no** se implementa la capa PWA (service worker, manifiesto, almacenamiento
  offline). Esta semana solo se pone en marcha el starter, se documenta y se deja reproducible.
- Todo el proyecto: autenticación con el directorio real de la universidad, integración con
  sistemas institucionales (inventario, órdenes de compra), gestión de presupuesto, telemetría de
  sensores IoT, aplicación de escritorio instalable y app en tiendas.
- No se capturan fotografías de personas ni datos que identifiquen a un individuo real.

## 2. Usuarios y escenarios

**Usuarios principales.**

| Usuario | Descripción | Contexto de uso |
| --- | --- | --- |
| Técnico/a de mantenimiento | Realiza las inspecciones en sitio. | Teléfono, de pie, conectividad variable. |
| Coordinador/a de laboratorios | Revisa inspecciones, prioriza hallazgos y da seguimiento. | Escritorio, buena conexión. |
| Docente/evaluador (solo lectura) | Verifica el avance del proyecto y la reproducibilidad. | Escritorio; clona el repositorio. |

**Escenario A — Conectividad normal (revisión).**
La coordinadora abre la aplicación desde su equipo con Wi‑Fi estable, ve el listado de inspecciones
recientes ordenadas por fecha, filtra por "requiere atención" y abre el detalle de una inspección
de laboratorio de electrónica para planear el seguimiento de sus 2 hallazgos.
*Resultado observable:* la lista muestra al menos las 3 inspecciones sintéticas y el filtro deja
solo las que tienen hallazgos ≥ 1.

**Escenario B — Conectividad intermitente (captura en sitio).**
Un técnico entra al laboratorio de redes, en el sótano, donde no hay señal. La aplicación ya estaba
abierta (o instalada). Abre el formulario de nueva inspección, captura el laboratorio, la fecha, los
ítems revisados y 1 hallazgo, y pulsa "Guardar". La aplicación guarda el registro en el dispositivo
y lo marca como **"pendiente de sincronización"**. El técnico sube a planta baja, la señal regresa y
la aplicación sincroniza el registro automáticamente; el distintivo cambia a **"sincronizada"**.
*Resultado observable (meta de una semana posterior):* con el modo avión activo el registro se
guarda y sobrevive a una recarga; al reactivar la red pasa a "sincronizada" sin que el usuario haga
nada.

**Escenario C — Primer arranque sin datos.**
Una persona clona el repositorio, ejecuta `npm ci` y `npm run dev`, y abre `http://localhost:3000`.
Ve la pantalla de inspecciones con el conjunto sintético de ejemplo y el aviso de que los datos son
sintéticos y de que la PWA aún no está implementada.
*Resultado observable:* la portada carga en menos de 2 s en local y muestra 3 inspecciones.

## 3. Requisitos funcionales

Estado: **[✔] implementado en el starter · [~] parcial · [ ] planificado para una semana posterior**.

- **RF-01 — Listar inspecciones recientes. [✔]**
  La pantalla principal muestra las inspecciones con ubicación, fecha, responsable, estado y número
  de hallazgos.
  *Criterio de aceptación:* con los datos sintéticos, `http://localhost:3000` muestra 3 tarjetas de
  inspección; `npm test` valida que la página contiene el listado y la etiqueta "sintéticos".

- **RF-02 — Ver el detalle de una inspección. [~]**
  Cada inspección expone todos sus campos: resumen, hallazgos, responsable, fecha y estado.
  *Criterio de aceptación:* al seleccionar una inspección del listado se muestran los 6 campos sin
  recargar la página.

- **RF-03 — Registrar una nueva inspección. [ ]**
  Un formulario permite capturar ubicación, fecha, responsable, ítems revisados y hallazgos.
  *Criterio de aceptación:* al enviar el formulario con datos válidos, la nueva inspección aparece
  en primer lugar del listado y persiste tras recargar.

- **RF-04 — Clasificar el estado de la inspección. [✔]**
  El estado se deriva del número de hallazgos: 0 → "sin incidencias"; ≥ 1 → "requiere atención", y
  se muestra con un distintivo de color.
  *Criterio de aceptación:* una inspección con 0 hallazgos se muestra como "sin incidencias" y una
  con 2 como "requiere atención".

- **RF-05 — Guardar inspecciones sin conexión. [ ]**
  Con el dispositivo sin red, la aplicación almacena la inspección localmente y la marca como
  "pendiente de sincronización".
  *Criterio de aceptación:* con el modo avión activo, guardar una inspección no produce error y el
  registro sigue visible después de recargar la aplicación.

- **RF-06 — Sincronizar inspecciones pendientes al recuperar la red. [ ]**
  Al restablecerse la conectividad, los registros "pendientes" se envían y pasan a "sincronizada"
  sin intervención del usuario.
  *Criterio de aceptación:* una prueba automatizada simula pérdida y regreso de red y verifica la
  transición de estado "pendiente" → "sincronizada".

- **RF-07 — Instalar la aplicación como PWA. [ ]**
  El navegador ofrece "Instalar" mediante un manifiesto válido y un service worker registrado.
  *Criterio de aceptación:* la auditoría de Lighthouse en la categoría PWA no reporta errores
  bloqueantes de instalabilidad.

- **RF-08 — Filtrar el listado por estado. [ ]**
  El usuario puede mostrar solo "requiere atención" o solo "sin incidencias".
  *Criterio de aceptación:* al elegir "requiere atención" el listado deja únicamente inspecciones
  con hallazgos ≥ 1.

- **RF-09 — Indicar el estado de conectividad y la cola pendiente. [ ]**
  La interfaz muestra "en línea / sin conexión" y cuántas inspecciones están pendientes de
  sincronizar.
  *Criterio de aceptación:* al desactivar la red el indicador cambia a "sin conexión" en menos de
  2 s y muestra el número de pendientes.

- **RF-10 — Cargar la semilla de datos sintéticos en el primer arranque. [✔]**
  Sin datos locales previos, la aplicación carga el conjunto sintético de `src/lib/data/inspections.ts`.
  *Criterio de aceptación:* en un navegador sin almacenamiento local para la app, la portada
  muestra las 3 inspecciones de ejemplo.

## 4. Requisitos no funcionales

- **RNF-01 — Reproducibilidad del arranque.**
  En Node.js 20 LTS, `git clone` + `npm ci` + `npm run build` terminan con código 0 sin pasos
  manuales adicionales. *Medición:* el workflow de GitHub Actions "Starter Semana 1 — feedback"
  ejecuta esos comandos en cada push y debe quedar en verde.

- **RNF-02 — Verificación local.**
  `make verify` (equivale a `npm run verify`) genera `reports/verification.json` con
  `"status": "pass"` y termina con código 0.

- **RNF-03 — Accesibilidad.**
  La pantalla principal cumple WCAG 2.1 AA en contraste (≥ 4.5:1 para texto normal), usa regiones
  semánticas (`<main>`, `<header>`, `<footer>`), jerarquía de encabezados sin saltos y es operable
  con teclado. *Medición:* 0 incidencias graves en axe DevTools o Lighthouse (Accesibilidad ≥ 95).

- **RNF-04 — Rendimiento.**
  La ruta `/` se entrega como contenido estático prerenderizado. *Medición:* Lighthouse Performance
  ≥ 90 en móvil simulado y JavaScript inicial de la ruta `/` < 130 kB comprimido.

- **RNF-05 — Operación offline (meta de semanas posteriores).**
  Tras la primera visita, la vista principal carga sin red (App Shell servido por el service
  worker) en menos de 2 s. *Medición:* en DevTools con "Offline" activo, la portada renderiza el
  listado desde caché.

- **RNF-06 — Seguridad del repositorio.**
  El repositorio no contiene archivos `.env` ni archivos de credenciales. *Medición:*
  `bash public-tests/check.sh` termina con código 0 y `npm audit --audit-level=critical` no reporta
  vulnerabilidades críticas.

- **RNF-07 — Privacidad.**
  La aplicación no recolecta ni almacena datos personales reales; todos los datos son sintéticos y
  la interfaz lo declara de forma visible. *Medición:* revisión del contenido de `src/lib/data/` y
  de la interfaz: ningún nombre, matrícula, correo o teléfono real.

- **RNF-08 — Portabilidad y diseño responsivo.**
  Funciona en las versiones estables de Chrome, Edge y Firefox de escritorio y en Chrome para
  Android. *Medición:* la interfaz es utilizable sin desplazamiento horizontal a 360 px de ancho.

- **RNF-09 — Mantenibilidad.**
  TypeScript en modo `strict`; el proyecto compila sin errores de tipos. *Medición:* `npm run build`
  ejecuta la verificación de tipos y termina con código 0.

- **RNF-10 — Operación y tamaño.**
  El árbol versionado pesa menos de 5 MB (sin `node_modules` ni `.next`) y el build de CI tarda
  menos de 10 min. *Medición:* `git count-objects -vH` y la duración del job en GitHub Actions.

## 5. Datos sintéticos y límites

**Qué datos se usan.** Únicamente el conjunto definido en `src/lib/data/inspections.ts`: 3
inspecciones ficticias de laboratorios genéricos (Redes, Electrónica, Software), con responsables
anónimos ("Técnica A", "Técnico B", "Técnica C"), fechas de agosto de 2026, número de hallazgos y
un resumen genérico. Cualquier dato adicional que se agregue durante el curso debe ser inventado y
no rastreable a una persona o a un activo real.

**Información prohibida.**

- Nombres reales de estudiantes, docentes o personal; matrículas; correos; teléfonos; firmas.
- Fotografías de personas o de espacios reales identificables.
- Ubicaciones, inventarios, números de serie o diagnósticos reales de la universidad.
- Credenciales, llaves de API, archivos `.env` o cualquier dato de acceso.

**Límites de volumen y formato para la actividad.**

- Entre 3 y 20 inspecciones cargadas a la vez.
- Entre 0 y 10 hallazgos por inspección.
- Campos de texto de hasta 280 caracteres; fechas en formato `AAAA-MM-DD`.
- Identificadores con el patrón `inspection-NNN`.

## 6. Criterios de aceptación de la Semana 1

| Entrega | Cómo se verifica |
| --- | --- |
| `docs/requirements.md` con las 6 secciones completas | Revisión del documento; `node scripts/verify.mjs` confirma que el archivo existe. |
| `docs/decision-record.md` con las 4 alternativas comparadas, decisión fechada y validación | Revisión del documento; `verify.mjs` confirma que el archivo existe. |
| El starter instala y compila | `npm ci` y luego `npm run build` terminan con código 0. |
| El starter arranca y muestra los datos | `npm run dev` sirve `http://localhost:3000` con 3 inspecciones sintéticas visibles. |
| Verificación reproducible | `make verify` termina en 0 y `reports/verification.json` tiene `"status": "pass"`. |
| Prueba mínima del starter | `npm test` imprime `starter.spec.mjs: PASS`. |
| Check público | `bash public-tests/check.sh` imprime `PUBLIC_OK`. |
| Integración continua en verde | El workflow "Starter Semana 1 — feedback" pasa los pasos verify, test, build y check. |
| Evidencia individual | `evidence/individual-<apellido>.md` de cada integrante con contribución, SHA evaluado, prueba ejecutada, limitación y declaración de uso de IA. |
| Repositorio limpio | Sin `node_modules/`, `.next/`, `.env*` ni archivos de credenciales versionados (`git ls-files` no los lista). |
