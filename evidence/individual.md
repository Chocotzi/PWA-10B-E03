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

## Nombre: [Compañero 2 - Módulo de Integración & Sincronización]

- Grupo y equipo: 10B · Equipo 03
- Mi contribución de esta semana y enlace: Implementación y soporte de pruebas de integración de persistencia offline y reintentos sin duplicados en [`tests/integration/`](../tests/integration/).
- Decisión técnica y motivo: [Completar por el integrante: Decisión técnica y motivo]
- Prueba/comando que ejecuté: `npx vitest run tests/integration`
- Resultado observado y enlace al reporte: [Completar por el integrante: Resultado observado y enlace]
- Qué demuestra y qué no demuestra: [Completar por el integrante: Qué demuestra y qué no demuestra]
- Limitación o riesgo: [Completar por el integrante: Limitación o riesgo]
- IA: herramienta, propósito, partes influidas y validación propia; o «no utilicé IA»: [Completar por el integrante]

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
