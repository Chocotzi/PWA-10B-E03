# Evidencia individual

- Estudiante: 3523110321
- Commit SHA evaluado: 62f9c36babd4d07dc14f2ee3d811d9e036673155
- Decisión técnica que puedo explicar: Implementé un "fallback" con datos sintéticos para las capacidades de la cámara y la geolocalización. La decisión principal fue devolver una promesa exitosa aunque el dispositivo no cuente con las APIs, retornando coordenadas estáticas y una imagen en base64 de 1x1 píxel.
- Prueba que ejecuté y resultado: Ejecuté `npm test` verificando con `vitest` que las funciones `captureImage` y `getCurrentLocation` devuelven éxito (success: true) y la información sintética esperada incluso simulando la ausencia del objeto global `navigator.mediaDevices` o `navigator.geolocation`. Todas las pruebas pasaron con éxito.
- Limitación o fallo diagnosticado: Al depender de datos estáticos en el fallback, los reportes en dispositivos sin GPS parecerán haber sido emitidos desde el mismo lugar geográfico siempre (UTT), lo cual falsearía los análisis espaciales si no consideramos un atributo como "useSynthetic". 
- Cambio que podría defender o modificar en vivo: Podría mostrar cómo capturar parámetros en la configuración para hacer las coordenadas más aleatorias, o cómo invocar `stream.getTracks().forEach(track => track.stop())` para no dejar la cámara encendida consumiendo recursos.
- Uso declarado de IA (herramienta, propósito, validación): Usé Gemini para dividir la carga de trabajo entre módulos independientes, estructurar los archivos `camera.ts` y `geolocation.ts` y documentar mi parte. Yo revisé y entiendo el código generado sobre los fallbacks.
## Benkis Carbajal Hernández — Semana 6

**Contribución:** Implementé `src/lib/notifications/client.ts` para detectar soporte, solicitar permiso
y mostrar notificaciones locales con datos sintéticos. Añadí pruebas reproducibles en
`tests/notifications.spec.ts` y documenté setup, límites y verificación.

**Decisión técnica:** La solicitud de permiso queda encapsulada y solo ocurre cuando la interfaz la llama
explícitamente; en entornos sin `Notification` se devuelve `unsupported` sin romper la aplicación.

**Prueba:** Pendiente de ejecutar en CI junto con `npm ci`, `make verify`, `npm test` y `npm run build`.

**Limitación:** Esto cubre notificaciones locales, no Push/Web Push ni entrega desde un backend.

**Uso de IA:** Codex apoyó la implementación, las pruebas y la documentación; revisé los archivos y los
casos sintéticos antes de integrarlos.

## Carlos Andrés Arriaga Márquez — Semana 6

- **Estudiante:** Carlos Andrés Arriaga Márquez
- **Rama:** `dev-carlos`, creada desde `dev-cleber` (`b37c1e7`) para conservar la Semana 5 y la primera versión de la Semana 6.
- **Commit SHA evaluado:** `PENDIENTE_SHA_DOCS` (contenido completo de la entrega; el commit siguiente solo registra este SHA).
- **Commits relevantes:** `PENDIENTE_SHA_FEAT` (implementación, integración y pruebas) y `PENDIENTE_SHA_DOCS` (documentación, README y comprobación en Chromium).

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
