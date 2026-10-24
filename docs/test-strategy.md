# Estrategia de Pruebas y Aseguramiento de Calidad · Semana 8

## 1. Diagnóstico Inicial de la PWA

Al retomar la PWA de la semana 6 y ejecutar las comprobaciones locales del flujo de captura offline, se diagnosticó el siguiente bloqueo crítico:

* **Fallo diagnosticado:** En el componente de captura [`src/components/inspection-capture-client.tsx`](../src/components/inspection-capture-client.tsx), la función `save(event)` ejecutaba `await queueRef.current.enqueue(...)` y posteriormente intentaba acceder a `event.currentTarget.reset()`. En React, los eventos sintéticos son reciclados o desreferenciados tras resoluciones asíncronas de promesas, lo que causaba un error en tiempo de ejecución:
  ```text
  TypeError: Cannot read properties of null (reading 'reset')
  ```
  Esto abortaba el flujo antes de que se pudiera invocar `setNotice("Inspección sintética guardada localmente.")` y `void flush()`.
* **Corrección aplicada:** Se capturó la referencia del formulario de manera síncrona al inicio del manejador de eventos: `const form = event.currentTarget;` antes de cualquier `await`. Con esto, la captura offline opera de forma determinista y sin excepciones no controladas.

---

## 2. Matriz Riesgo vs Capa de Prueba

Conforme al requerimiento AC-04 de la semana 8, se mapearon los riesgos críticos del negocio contra la capa de prueba óptima:

| Riesgo Técnico / Operativo | Capa Asignada | Archivo de Prueba | Justificación de la Capa |
| :--- | :--- | :--- | :--- |
| **1. Captura inválida:** IDs malformados, fechas no estandarizadas o campos fuera de rango. | **Unitaria** | `tests/unit/inspections-domain.spec.ts` | Las reglas de validación son funciones puras e independientes de la interfaz; la prueba unitaria ofrece retroalimentación instantánea (< 10 ms) ante cualquier entrada inválida. |
| **2. Persistencia y reconexión:** Pérdida de inspecciones capturadas sin red tras recargar el navegador. | **Integración** / **E2E** | `tests/integration/offline-persistence-and-sync.spec.ts`<br>`tests/e2e/critical-inspection-flow.spec.ts` | Requiere validar que la capa de almacenamiento en IndexedDB sobreviva al cierre/reapertura de pestañas y que el estado se reconcilie en la interfaz al volver el evento `online`. |
| **3. Duplicado de sincronización:** Reenvío de una misma mutación creando múltiples registros en el servidor. | **Unitaria** & **Integración** | `tests/unit/queue-idempotency.spec.ts`<br>`tests/integration/offline-persistence-and-sync.spec.ts` | La deduplicación opera en dos frentes: la cola cliente deduplica llamadas a `flush()` compartiendo la misma promesa de drenaje, y el endpoint `/api/inspecciones` valida la clave de idempotencia (`mutation.id`). |
| **4. Permisos de dispositivo no disponibles:** Bloqueo de la aplicación por cámara o GPS denegados/ausentes. | **Unitaria** & **E2E** | `tests/unit/device-capabilities.spec.ts`<br>`tests/e2e/critical-inspection-flow.spec.ts` | Debe asegurarse que las funciones `captureImage` y `getCurrentLocation` retornen datos sintéticos de respaldo (*fallback*) y que el formulario permita completar el registro sin colapsar. |

---

## 3. Pirámide de Pruebas y Aislamiento

```
            / \
           /   \         Capa E2E (tests/e2e/)
          / E2E \        - Flujo crítico completo en UI
         /-------\       - Recarga sin conexión y reconexión
        / Integr. \      Capa de Integración (tests/integration/)
       /           \     - Persistencia IndexedDB + Endpoint con Idempotencia
      /-------------\
     /   Unitarias   \   Capa Unitaria (tests/unit/)
    /                 \  - Reglas de dominio, validaciones, cola e idempotencia
   /-------------------\
```

### 3.1. Pruebas Unitarias (`tests/unit/`)
* **Regla de validación:** Validación estricta de IDs con regex `^inspection-\d{3}$`, formato de fechas `YYYY-MM-DD`, y contratos de datos sintéticos (`inspections-domain.spec.ts`).
* **Regla de la cola e idempotencia:** Rechazo de mutaciones sin ID, deduplicación en llamadas simultáneas a `flush()`, y retención FIFO ante caídas de transporte (`queue-idempotency.spec.ts`).
* **Regla de bloqueo optimista:** Matriz de decisiones de conflicto `decideConflict` (`conflict-policy.spec.ts`).
* **Aislamiento de hardware:** Mocking de `getUserMedia` verificando `track.stop()` y stubs de geolocalización con coordenadas sintéticas de la UTT (`device-capabilities.spec.ts`).

### 3.2. Pruebas de Integración (`tests/integration/`)
* **Persistencia local:** Inserción y recuperación en IndexedDB usando `fake-indexeddb` simulando ciclos de cerrado y reapertura de la base de datos.
* **Idempotencia remota:** Reintentos múltiples de la misma mutación al endpoint `/api/inspecciones` respondiendo `200 OK` con la misma revisión aplicada en lugar de crear duplicados o conflicto `409`.

### 3.3. Pruebas End-to-End (`tests/e2e/`)
* **Flujo crítico de usuario:** Creación en interfaz con `navigator.onLine = false` ➔ guardado en IndexedDB ➔ desmontaje y remonte del componente simulando recarga ➔ activación del evento `online` ➔ sincronización exitosa y actualización de la vista.
* **Variante sin permisos:** Captura completada exitosamente a pesar de cámara o GPS denegados mediante el uso de datos sintéticos.

---

## 4. Evidencia del Defecto Controlado

Para dar cumplimiento al criterio **AC-03** y demostrar que la suite de pruebas es capaz de detectar regresiones reales:

### 4.1. Introducción del Defecto
Se introdujo una modificación controlada en [`src/app/api/inspecciones/route.ts`](../src/app/api/inspecciones/route.ts) omitiendo la verificación de acuse previo (protección de idempotencia):

```typescript
// DEFECTO INTRODUCIDO: Omitir verificación de acuses previos
// const previous = acknowledgements.get(mutation.id);
// if (previous) return json(previous);
```

### 4.2. Salida Real del Fallo
Al ejecutar la prueba de integración de idempotencia, el segundo envío generó un conflicto `409` en lugar de devolver la respuesta exitosa previa:

```text
$ npx vitest run tests/integration/offline-persistence-and-sync.spec.ts

 FAIL  tests/integration/offline-persistence-and-sync.spec.ts > Integration: Offline Persistence & Duplicate-Free Sync > reintentar la sincronización de la misma operación contra el endpoint no crea un duplicado (idempotencia)
AssertionError: expected 409 to be 200 // Object.is equality

- Expected
+ Received

- 200
+ 409

 ❯ tests/integration/offline-persistence-and-sync.spec.ts:100:25
    100|     expect(res2.status).toBe(200);
       |                         ^
    101|     expect(body2.kind).toBe("applied");

 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)
```

### 4.3. Recuperación tras Restaurar la Solución
Se restauró la verificación del mapa de `acknowledgements` y la prueba pasó inmediatamente al 100%:

```text
$ npx vitest run tests/integration/offline-persistence-and-sync.spec.ts

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Duration  290ms
```

---

## 5. Política de Datos Sintéticos y Privacidad

* **Sin PII ni secretos:** No se almacena información personal ni llaves de API.
* **Coordenadas fijas:** Coordenadas de prueba UTT (`18.4627, -97.3928`).
* **Imágenes sintéticas:** Imagen de 1x1 píxel en Base64 para simulación ligera.

---

## 6. Comandos de Verificación Local

```bash
# Ejecutar suite completa (Unitarias, Integración, E2E)
npm test

# Ejecutar únicamente pruebas unitarias
npm run test:unit

# Ejecutar pruebas de integración
npx vitest run tests/integration

# Ejecutar pruebas E2E
npx vitest run tests/e2e

# Verificar build de producción
npm run build

# Verificación de artefactos
npm run verify
```
