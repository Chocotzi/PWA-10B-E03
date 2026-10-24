# PWA de Inspecciones y Mantenimiento de Laboratorios · Semana 8

Este repositorio contiene la PWA desarrollada para la Universidad Tecnológica de Tehuacán. En esta etapa (Semana 8) se integró la suite de pruebas automatizadas en tres capas (Unitarias, Integración y E2E), la verificación continua en GitHub Actions y la estrategia de aseguramiento de calidad ante fallos de conectividad y hardware.

---

## 1. Requisitos del Entorno

* **Node.js:** `>=20.9.0` (recomendado v20.x, declarado en `.nvmrc` y `package.json`).
* **npm:** `>=10.0.0`
* **Sistema Operativo:** macOS, Linux o Windows.

---

## 2. Instalación y Setup

Para una instalación limpia y determinista con el archivo de bloqueo:

```bash
npm ci
```

---

## 3. Ejecución de la Aplicación

```bash
# Modo desarrollo (puerto 3000 por defecto)
npm run dev

# Compilación de producción
npm run build

# Arranque del servidor de producción (usado para pruebas E2E o despliegue)
npm start
```

---

## 4. Comandos de Comprobación y Verificación

La verificación automatizada se ejecuta localmente mediante `make verify` o `npm run verify`:

| Comando | Equivalente exacto | Qué ejecuta |
| :--- | :--- | :--- |
| `make verify` | `npm run verify` | Valida la existencia y correspondencia de todos los artefactos obligatorios y genera `reports/verification.json`. Termina con código 1 si falta alguno. |
| `npm test` | `node tests/starter.spec.mjs && vitest run` | Ejecuta la suite completa de pruebas automatizadas (Unitarias, Integración, E2E y regresión). |
| `npm run test:unit` | `vitest run tests/unit` | Ejecuta las pruebas unitarias de reglas de validación, cola/idempotencia y fallbacks. |
| `npm run build` | `next build` | Valida tipado estático con TypeScript y compila el bundle de producción sin errores. |
| `bash public-tests/check.sh` | - | Verifica checks públicos de artefactos y ausencia de secretos expuestos. |

---

## 5. Estructura de Pruebas de la Semana 8

* **`tests/unit/`:** Pruebas unitarias sobre funciones puras, validación estricta de IDs, ordenamiento, cola de sincronización con deduplicación/idempotencia (`queue-idempotency.spec.ts`) y fallbacks de hardware.
* **`tests/integration/`:** Pruebas de integración sobre persistencia en IndexedDB (`fake-indexeddb`) sin conexión y reintentos sin duplicados en el endpoint `/api/inspecciones`.
* **`tests/e2e/`:** Pruebas de flujo crítico de usuario en interfaz: formulario ➔ guardado offline ➔ recarga simulada sin pérdida ➔ reconexión y sincronización sin duplicados, más variante ante permisos denegados.
* **`docs/test-strategy.md`:** Documento de estrategia de testing, diagnóstico inicial, matriz riesgo-prueba y evidencia reproducible del defecto controlado.
* **`.github/workflows/academic-evaluation.yml`:** Pipeline de CI automatizado con etapas de instalación limpia, comprobación de tipos, build, ejecución de capas de pruebas y publicación de artefactos.
* **`evidence/individual.md`:** Evidencia individual de cada estudiante conforme a la plantilla requerida.

---

## 6. Política de Datos Sintéticos

La aplicación utiliza exclusivamente datos sintéticos:
* Identificadores con formato `inspection-00X` o `synthetic-[UUID]`.
* Coordenadas de prueba estáticas correspondientes a la Universidad Tecnológica de Tehuacán (`18.4627, -97.3928`).
* Imágenes sintéticas en base64 de 1x1 píxel para pruebas de captura sin requerir cámara real.
* No se incluyen secretos, tokens ni información personal real (Zero PII).
