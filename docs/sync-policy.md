# Política de sincronización — incremento de Cleber

## División del trabajo

| Responsable | Entrega |
| --- | --- |
| Cleber (`dev-cleber`, este PR) | Esquema IndexedDB de mutaciones, cola FIFO con reintentos, política de conflictos, pruebas reproducibles, decisión y evidencia. |
| Compañero (rama propia) | Formulario de captura y estado visible, endpoint de escritura con revisión e idempotencia, conexión de `createSyncQueue` al evento `online` y pruebas de interfaz/API. |

La rama de Cleber expone el contrato que necesita la integración. No afirma que la captura o el envío automático ya estén conectados a la interfaz. Ambos cambios deben integrarse y probarse juntos antes de presentar RF-05/RF-06 como completos.

## Datos y almacenamiento

Solo se usan registros sintéticos. `src/lib/storage/schema.ts` abre IndexedDB `inspecciones-sync`, versión 1, con el almacén `mutations` y clave `id`. Cada mutación contiene el registro, la revisión observada (`baseRevision`), fecha de creación, estado y, si existe, revisión remota del conflicto. La operación se añade en una transacción completa antes de informarla como encolada. El cierre y nueva apertura conservan la cola. Borrar datos del sitio elimina estas copias locales.

## Envío y fallos

`createSyncQueue(storage, transport)` procesa pendientes por `createdAt` e `id`. Un fallo de red o del transporte detiene el lote y deja los registros pendientes. Un acuse `applied` con revisión válida permite borrar la mutación. Dos llamadas simultáneas a `flush` en una pestaña comparten la misma promesa. En varias pestañas, o tras una caída entre respuesta y borrado local, puede repetirse el mismo envío; por ello el endpoint debe deduplicar por `mutation.id`. No se usa Background Sync: el compañero debe llamar `flush` al iniciar y al recibir `online`, además de ofrecer reintento manual si el navegador no emite el evento.

## Conflictos

El servidor debe comparar `baseRevision` con su revisión actual **dentro de la misma transacción que escribe**. Si son iguales, aplica la mutación y devuelve una nueva revisión. Si difieren, responde `conflict` con `serverRevision`; la cola conserva la versión local en estado `conflict` y deja de reintentarla automáticamente. No se sobrescribe silenciosamente el dato remoto. Un flujo futuro debe mostrar ambas versiones y permitir una decisión explícita del usuario. Si el servidor declara conflicto con la misma revisión base, el cliente considera la respuesta contradictoria y deja el registro pendiente.

## Supuestos y límites

- `SyncTransport.send` es un adaptador aún no implementado para la API; debe distinguir acuse, conflicto y error transitorio, y nunca tratar un HTTP 5xx como `applied`.
- El endpoint de escritura y la interfaz aún no existen. La cola no puede demostrar sincronización entre dispositivos hasta que el compañero los integre.
- El identificador de mutación debe mantenerse estable en cada reintento. `crypto.randomUUID()` lo crea al encolar; las pruebas inyectan identificadores fijos.
- La cola preserva el orden dentro de una pestaña; la deduplicación y el control de concurrencia entre pestañas corresponden al servidor.
- No hay migración desde una base previa porque esta es la primera versión del esquema. Una versión futura debe probar su migración antes de subir `SYNC_DB_VERSION`.

## Verificación

`npm ci`, `make verify`, `npm test`, `npm run build` y GitHub Actions. `tests/sync.spec.ts` comprueba persistencia tras reabrir IndexedDB, rechazo de identificadores repetidos, reintento de red, orden FIFO, llamadas simultáneas y conflicto conservado. La suite usa una implementación simulada de IndexedDB y datos sintéticos; no necesita un servicio remoto.
