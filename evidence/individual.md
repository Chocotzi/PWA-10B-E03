# Evidencia individual — Semana 5

- **Grupo y equipo:** Aplicaciones Web Progresivas 10B — Equipo E03
- **Repositorio:** https://github.com/Chocotzi/PWA-10B-E03
- **Rama de trabajo:** `dev-cleber`
- **SHA evaluado:** `<pendiente: reemplazar por el SHA del commit final>`
- **Actions:** https://github.com/Chocotzi/PWA-10B-E03/actions

## Cleber Antonio Bolaños Moreno — Semana 5

**Commit de implementación:** `fe01d58cce00674634e5d22c2351a036b9538f4a` en `dev-cleber`.

**Decisión técnica:** Las mutaciones se guardan en IndexedDB antes del envío. La cola conserva el
mismo identificador en cada reintento y elimina una mutación únicamente después de recibir un acuse
con revisión. Si la revisión remota difiere, conserva la copia local como conflicto para revisión
explícita.

**Prueba ejecutada:** En la contribución base se ejecutaron `npm ci --no-audit --no-fund`, `make verify`,
`npm test` y `npm run build`; el reporte registrado indica `PASS`, con pruebas de persistencia, ids
repetidos, red caída y recuperada, FIFO, llamadas simultáneas y conflictos.

**Limitación y fallo encontrado:** La implementación base no incluía originalmente el endpoint ni la
conexión con el formulario y el evento `online`; esta integración de Semana 5 los añade. IndexedDB y
los reintentos aún requieren una prueba de integración en un navegador real.

**Uso declarado de IA:** Codex apoyó la redacción e implementación de `schema.ts`, `queue.ts`,
`conflict-policy.ts`, las pruebas, la documentación y el workflow. La evidencia corresponde a la
contribución registrada en `dev-cleber`.

## Benkis Carbajal Hernández — Semana 5

### Contribución

Conecté el núcleo de sincronización con la captura de inspecciones sintéticas:

- Formulario de captura en `src/components/inspection-capture-client.tsx`.
- Persistencia local mediante `createSyncQueue().enqueue()` e IndexedDB.
- Recuperación de inspecciones pendientes después de recargar.
- Sincronización al arranque, al evento `online` y mediante reintento manual.
- Indicadores de conexión, pendientes y conflictos.
- Endpoint `POST /api/inspecciones` con deduplicación por `mutation.id` y comparación de `baseRevision`.
- Pruebas del endpoint en `tests/write-endpoint.spec.ts`.

### Decisión técnica

La inspección se guarda primero en IndexedDB y después se intenta enviar. Esto garantiza que una
captura sin conexión permanezca visible tras recargar y que un fallo de red no elimine la copia local.
La cola conserva el identificador de mutación para que el endpoint pueda responder idempotentemente.

### Prueba ejecutada y resultado real

```text
node node_modules/typescript/bin/tsc --noEmit
Resultado: correcto, sin errores.

node tests/starter.spec.mjs
Resultado: starter.spec.mjs: PASS

node scripts/verify.mjs
Resultado: Starter verificable: PASS
```

Vitest quedó pendiente de ejecución en este entorno porque no pudo resolver `vitest.config.mts` por una
restricción de permisos. Debe ejecutarse en CI antes de cerrar la entrega, junto con `npm ci`, `npm test`
y `npm run build`.

### Limitación o fallo encontrado

El endpoint de escritura usa memoria del proceso para las revisiones y acuses idempotentes. Al reiniciar
el servidor se pierde ese estado; una versión de producción debe usar almacenamiento transaccional
persistentemente compartido.

### Uso declarado de IA

- **Herramienta:** Codex.
- **Propósito:** apoyar la integración del formulario offline, el endpoint, las pruebas y la documentación.
- **Partes influidas:** `src/components/inspection-capture-client.tsx`, `src/app/api/inspecciones/route.ts`,
  `tests/write-endpoint.spec.ts`, `docs/sync-policy.md` y esta sección.
- **Verificación humana:** revisé el diff y ejecuté TypeScript, la prueba starter y `scripts/verify.mjs`.
