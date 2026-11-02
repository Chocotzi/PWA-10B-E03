# Inventario de datos y privacidad (Semana 9)

> Fuente única en código: `PRIVACY_INVENTORY` en [`src/lib/security/privacy.ts`](../src/lib/security/privacy.ts).
> La prueba `T-13 · cada campo que la validación admite está en el inventario` de
> [`tests/security.spec.ts`](../tests/security.spec.ts) falla si se agrega un campo a la mutación sin documentarlo aquí y en el código.
> **Todos los datos del curso son sintéticos.** Aun así, el nombre del responsable, el resumen libre, la foto y la
> ubicación se tratan como datos personales para practicar la minimización.

## 1. Inventario

Lugares: **IDB** = IndexedDB del dispositivo (cola `inspecciones-sync`) · **MEM** = memoria del servidor de demostración ·
**NOT** = notificación local · **Caché** = Cache Storage del service worker.

| Dato | Campo | Categoría | Finalidad | Fundamento | Dónde vive | Quién accede | Retención | Minimización |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Responsable | `inspection.inspector` | **Personal** | Saber quién inspeccionó | Finalidad académica del proyecto; en el curso solo nombres sintéticos | IDB; viaja a la API al sincronizar | Persona usuaria del dispositivo; API | Hasta sincronizar o «Borrar datos locales» | Máx. 80 caracteres; nunca en notificaciones ni bitácoras (`redactForLog`) |
| Laboratorio | `inspection.location` | Operativo | Identificar el espacio revisado | Igual | IDB, NOT | Personal del laboratorio | Igual | Nombre del espacio, no un domicilio; máx. 80 |
| Resumen | `inspection.summary` | **Personal** (texto libre) | Describir observaciones | Igual | IDB; API | Persona usuaria; API | Igual | Máx. 500; el aviso pide no escribir datos personales; oculto en bitácoras |
| Hallazgos | `inspection.findings` | Operativo | Priorizar mantenimiento | Igual | IDB; API | Aplicación | Igual | Entero 0–1000 |
| Estado y etiqueta | `inspection.status`, `statusLabel` | Operativo | Clasificar el resultado | Igual | IDB; API | Aplicación | Igual | Valores cerrados |
| Fecha | `inspection.date` | Operativo | Ordenar y consultar | Igual | IDB; API | Aplicación | Igual | Solo fecha |
| Foto | `inspection.evidence.photo` (y `dataUrl`) | **Personal** | Documentar el hallazgo | Igual; opcional, la persona decide adjuntarla | IDB; API | Persona usuaria; API | Igual | Opcional; solo JPEG ≤ 1280 px y ≤ 1 MiB; al recodificarse en canvas se pierden los metadatos EXIF; nunca en bitácoras |
| Metadatos de la foto | `mimeType`, `width`, `height`, `bytes`, `source`, `capturedAt` | Técnico | Validar formato y tamaño | Igual | IDB; API | Aplicación | Igual | Valores acotados |
| Ubicación aproximada | `inspection.evidence.location` (`latitude`, `longitude`) | **Personal** | Situar la inspección | Igual; opcional y solo tras un clic | IDB; API | Persona usuaria; API | Igual | Redondeo a 3 decimales (≈100 m); precisión declarada ≥ 100 m; nunca en bitácoras |
| Precisión y hora de ubicación | `accuracyMeters`, `capturedAt` | Técnico | Informar la incertidumbre | Igual | IDB; API | Aplicación | Igual | Mínimo 100 m |
| Identificador de mutación | `id` | Técnico | Idempotencia (sin duplicados) | Necesario para el funcionamiento | IDB, MEM | Aplicación y API | IDB hasta sincronizar; MEM hasta reiniciar o expulsión (tope 5000) | UUID aleatorio |
| Revisiones | `baseRevision`, `serverRevision` | Técnico | Detectar conflictos | Igual | IDB, MEM | Aplicación y API | Igual | Valores opacos |
| Marca de cola | `createdAt`, `status` | Técnico | Orden y estado de la cola | Igual | IDB | Aplicación | Hasta sincronizar o borrar | Solo marca de tiempo y dos estados |
| Identificador de inspección | `inspection.id` | Operativo | Referenciar el registro | Igual | IDB, MEM | Aplicación y API | Igual | UUID aleatorio |
| Estado de permisos | (cámara, ubicación, notificaciones) | Técnico | Explicar qué está disponible | Lo decide el navegador | Navegador; la app no lo guarda | Navegador | Lo gestiona el navegador | Solo se consulta en el momento; no se almacena ni se envía |

Notas:

- La caché del service worker **no** guarda `/api` ni respuestas `no-store`, así que ningún dato del inventario vive en Cache Storage.
- Las notificaciones solo incluyen el laboratorio; la prueba de capacidades verifica que no aparezcan responsable ni resumen.
- La memoria del servidor solo guarda identificadores y revisiones, no el contenido de la inspección.

## 2. Marco legal (verificado el 1 de noviembre de 2026)

La UT Tehuacán es una institución pública, así que es **sujeto obligado** y le aplican las leyes de transparencia y de
protección de datos personales en posesión de sujetos obligados. En 2025 se expidieron leyes nuevas y cambió la
autoridad garante:

- **Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados.** Nueva ley publicada en el DOF el
  20 de marzo de 2025; última reforma publicada en el DOF el 14 de noviembre de 2025, según la Cámara de Diputados.
  Su artículo 3 define la **Secretaría** como la *Secretaría Anticorrupción y Buen Gobierno* y a las **autoridades
  garantes**; el INAI dejó de existir.
- **Ley General de Transparencia y Acceso a la Información Pública.** Nueva ley publicada en el DOF el 20 de marzo de
  2025; la Cámara de Diputados no registra reformas.
- **Ámbito estatal (Puebla).** Si la UT Tehuacán es un organismo del Gobierno del Estado, también aplica la ley estatal
  de protección de datos personales en posesión de sujetos obligados. Según notas de prensa de julio de 2025, el
  ITAIPUE se extinguió y sus atribuciones pasaron a la Secretaría Anticorrupción y Buen Gobierno estatal. **Esto no se
  confirmó en el Periódico Oficial del Estado**: debe confirmarlo la Unidad de Transparencia antes de usar este texto
  fuera del curso.

Este proyecto **no sustituye** al aviso oficial de la institución. Los artículos citados abajo se tomaron del texto
publicado en el DOF; antes de reutilizarlos, revisar la versión vigente.

## 3. Elementos del aviso de privacidad

El artículo 21 de la ley general enumera el contenido del aviso integral. Aplicado a este prototipo:

| Elemento | Contenido en el prototipo |
| --- | --- |
| Responsable (denominación y domicilio) | Proyecto académico del Equipo 03, grupo 10B, UT Tehuacán. El domicilio institucional lo aporta la Unidad de Transparencia; aquí no se publica. |
| Datos que se tratan | Los del inventario (§1). Se señalan como personales el responsable, el resumen, la foto y la ubicación. |
| Finalidades | Registrar inspecciones de laboratorio y sincronizarlas. No hay finalidades secundarias (ni perfiles ni publicidad). |
| Fundamento | Finalidad académica; en el curso solo se usan datos sintéticos, sin personas titulares reales. |
| Transferencias | Ninguna. Para un sistema real, los artículos 59, 60 y 64 regulan cuándo se necesita consentimiento y cómo se formaliza una transferencia. |
| Derechos ARCO | Acceso, rectificación, cancelación y oposición (artículos 37 a 41) ante la Unidad de Transparencia de la institución. En el prototipo, la persona puede borrar sus datos locales con el botón «Borrar datos locales». |
| Cambios al aviso | Se publican en el repositorio (`docs/privacy-data-inventory.md`) con fecha y commit. |

La versión corta está en la pantalla de captura (`src/components/privacy-panel.tsx`) y enlaza a este documento.

## 4. Controles implementados

| Control | Dónde | Prueba |
| --- | --- | --- |
| Inventario tipado como fuente única | `PRIVACY_INVENTORY` | `T-13 · cada campo que la validación admite está en el inventario (y viceversa)` |
| Bitácoras sin datos personales | `redactForLog` | `T-13 · redactForLog no deja pasar responsable, resumen, foto ni coordenadas` |
| Borrado local | `purgeLocalData` y botón «Borrar datos locales» | `T-12 · …` en `tests/security.spec.ts` y `tests/integration/privacy.spec.ts` |
| Ubicación redondeada y foto recodificada | `src/lib/device/` (Semana 6) | `tests/capabilities.spec.ts` |
| Nada de `/api` en caché | `public/sw.js` | `tests/service-worker.spec.ts` |

## 5. Límites

- IndexedDB **no está cifrada**: quien tenga acceso a la sesión del navegador puede leer la cola hasta que se sincroniza o se borra.
- «Borrar datos locales» elimina la cola del dispositivo, **no** lo ya sincronizado en el servidor (que en la demostración vive en memoria y desaparece al reiniciar).
- No hay autenticación, así que no se puede saber qué persona ejerció un derecho ni quién hizo cada cambio (T-14).
- `redactForLog` oculta por nombre de clave y por prefijo `data:`. Un dato personal escrito en un campo libre no marcado (por ejemplo, en el laboratorio) no se detecta.
