# Evidencia individual

## Estudiante: 3523110321 — Pruebas Automatizadas y Estrategia de Calidad

- **Estudiante:** 3523110321
- **Commit SHA evaluado:** 6e17b41a5d3ec5c1cf8d69e859103c4c5bdec4de
- **Decisión técnica que puedo explicar:** Diseñé la estrategia global de pruebas (`docs/test-strategy.md`) e implementé la suite completa de pruebas unitarias (`tests/unit/`). Decidí aislar rigurosamente la lógica pura de dominio, esquemas de almacenamiento (`fake-indexeddb`) y políticas de conflicto ejecutándolas bajo Vitest en entorno `node`, eliminando la necesidad de levantar un navegador headless para reglas de negocio. Esto redujo el tiempo de ejecución a menos de 400 ms garantizando determinismo estricto, 0 flakiness y desacoplamiento de dependencias del navegador.
- **Prueba que ejecuté y resultado:** Ejecuté `npm run test:unit` y `npm test`, ejecutando con éxito 33 pruebas unitarias distribuidas en 5 suites (`inspections-domain`, `conflict-policy`, `storage-schema`, `device-capabilities`, `notifications-client`) con código de salida 0 y 100% de aserciones aprobadas.
- **Limitación o fallo diagnosticado:** Las pruebas unitarias con stubs verifican contratos y fallbacks de manera estricta pero no detectan problemas de renderizado visual específicos de navegadores móviles o transacciones asíncronas bloqueadas en implementaciones reales de WebKit/Blink para IndexedDB, lo cual justifica la necesidad de los niveles de integración y E2E que completan mis compañeros.
- **Cambio que podría defender o modificar en vivo:** Puedo modificar en vivo cualquiera de los casos de prueba de `decideConflict` o `isValidInspectionId` para demostrar cómo una regresión rompe la suite inmediatamente, o agregar un nuevo caso borde en `openMutationStorage` validando el manejo de transacciones abortadas en IndexedDB.
- **Uso declarado de IA (herramienta, propósito, validación):** Utilicé Gemini para estructurar la estrategia de pruebas formal en `docs/test-strategy.md` y diseñar casos de prueba exhaustivos para `tests/unit/`. Validé manualmente cada caso de prueba, los tipos en TypeScript y aseguré que ninguna prueba dependiera de APIs externas ni datos reales.

---

## Histórico de Entregas

### Estudiante: 3523110321 — Capacidades de Dispositivo y Notificaciones (Semana 6)

- **Estudiante:** 3523110321
- **Commit SHA evaluado:** 62f9c36babd4d07dc14f2ee3d811d9e036673155
- **Decisión técnica que puedo explicar:** Implementé un "fallback" con datos sintéticos para las capacidades de la cámara y la geolocalización. La decisión principal fue devolver una promesa exitosa aunque el dispositivo no cuente con las APIs, retornando coordenadas estáticas y una imagen en base64 de 1x1 píxel.
- **Prueba que ejecuté y resultado:** Ejecuté `npm test` verificando con `vitest` que las funciones `captureImage` y `getCurrentLocation` devuelven éxito (success: true) y la información sintética esperada incluso simulando la ausencia del objeto global `navigator.mediaDevices` o `navigator.geolocation`. Todas las pruebas pasaron con éxito.
- **Limitación o fallo diagnosticado:** Al depender de datos estáticos en el fallback, los reportes en dispositivos sin GPS parecerán haber sido emitidos desde el mismo lugar geográfico siempre (UTT), lo cual falsearía los análisis espaciales si no consideramos un atributo como "useSynthetic". 
- **Cambio que podría defender o modificar en vivo:** Podría mostrar cómo capturar parámetros en la configuración para hacer las coordenadas más aleatorias, o cómo invocar `stream.getTracks().forEach(track => track.stop())` para no dejar la cámara encendida consumiendo recursos.
- **Uso declarado de IA (herramienta, propósito, validación):** Usé Gemini para dividir la carga de trabajo entre módulos independientes, estructurar los archivos `camera.ts` y `geolocation.ts` y documentar mi parte. Yo revisé y entiendo el código generado sobre los fallbacks.

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
