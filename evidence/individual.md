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

## Nombre: [Compañero 3 - Módulo E2E & Automatización CI/CD]

- Grupo y equipo: 10B · Equipo 03
- Mi contribución de esta semana y enlace: Implementación de pruebas E2E del flujo crítico en [`tests/e2e/`](../tests/e2e/) y workflow de CI en [`.github/workflows/academic-evaluation.yml`](../.github/workflows/academic-evaluation.yml).
- Decisión técnica y motivo: [Completar por el integrante: Decisión técnica y motivo]
- Prueba/comando que ejecuté: `npx vitest run tests/e2e`
- Resultado observado y enlace al reporte: [Completar por el integrante: Resultado observado y enlace]
- Qué demuestra y qué no demuestra: [Completar por el integrante: Qué demuestra y qué no demuestra]
- Limitación o riesgo: [Completar por el integrante: Limitación o riesgo]
- IA: herramienta, propósito, partes influidas y validación propia; o «no utilicé IA»: [Completar por el integrante]

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
