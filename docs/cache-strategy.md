# Estrategia de caché de la PWA Semana 3

## 1. Objetivo y alcance

Esta estrategia sustenta la consulta offline del listado de inspecciones sintéticas. Después de
una primera visita correcta, el App Shell y sus recursos esenciales quedan disponibles para que la
portada pueda abrirse sin conexión. La entrega cubre lectura offline y actualización segura del
Service Worker.

La captura offline de nuevas inspecciones y su sincronización posterior no forman parte de S3.
Esas capacidades corresponden a RF-05 y RF-06 y se implementarán en semanas posteriores.

## 2. Inventario de recursos y estrategia por tipo

| Recurso o solicitud | Estrategia | Justificación |
| --- | --- | --- |
| `/`, `/offline`, manifest e íconos de `public/icons/` | Precache | Son el App Shell y el respaldo mínimo que debe estar disponible después de la primera visita. |
| `/_next/static/**` | Cache-first | Son archivos estáticos generados por Next y versionados; reutilizarlos reduce solicitudes sin servir HTML antiguo. |
| Navegaciones HTML | Network-first y luego caché o `/offline` | Las inspecciones pueden cambiar, por lo que se intenta obtener primero la versión más reciente. |
| `/api/**` | Sin interceptar ni guardar | Las futuras respuestas del backend pueden contener información que no debe persistir automáticamente. |
| Solicitudes `POST` o cualquier método distinto de `GET` | Sin interceptar ni guardar | El Service Worker solo consulta recursos; no debe alterar operaciones de escritura. |
| Otro origen | Sin interceptar ni guardar | La aplicación solo controla recursos de su propio origen. |
| Respuestas con estado distinto de 200 o `Cache-Control: no-store` | No guardar | Evita conservar errores o respuestas que explícitamente prohíben almacenamiento. |

## 3. Ciclo de vida y actualización segura

La caché se identifica con un nombre versionado, actualmente `inspecciones-v1`. Cada cambio en los
recursos de `PRECACHE_URLS` debe incrementar el número de versión.

Durante `install`, el Service Worker abre esa caché y ejecuta `cache.addAll(PRECACHE_URLS)`.
`addAll` tiene semántica atómica: si un recurso falla, la promesa falla y la instalación completa
no termina. El error se registra y se vuelve a lanzar para no dejar un App Shell incompleto.

Durante `activate`, se obtienen todas las cachés y se elimina cada una cuyo nombre no coincide con
`CACHE_VERSION`. Después se ejecuta `self.clients.claim()`.

No se usa `skipWaiting` automáticamente. El flujo controlado es:

```text
waiting -> aviso al usuario -> SKIP_WAITING -> controllerchange -> recarga única
```

Esto evita activar una versión nueva antes de que el usuario lo confirme y reduce el riesgo de
mezclar HTML, JavaScript e íconos pertenecientes a despliegues diferentes.

## 4. Invalidación controlada

Para forzar una versión nueva se cambia, por ejemplo:

```js
const CACHE_VERSION = "inspecciones-v2";
```

La nueva versión se instala sin borrar inmediatamente `inspecciones-v1`. Mientras permanece en
`waiting`, la versión anterior sigue atendiendo las páginas abiertas. Al activar la nueva versión,
`activate` elimina la caché anterior.

Durante una revisión manual, el usuario o el equipo puede limpiar el almacenamiento desde
`DevTools -> Application -> Storage -> Clear site data`. También puede eliminar una caché concreta
desde la consola con `caches.delete("inspecciones-v1")`.

## 5. Datos sensibles y privacidad

La versión actual trabaja únicamente con datos sintéticos y no contiene información personal real.
El Service Worker no intercepta `/api/**`, solicitudes que no sean `GET`, solicitudes de otro origen
ni respuestas con `Cache-Control: no-store`. Estas reglas evitan crear una copia persistente de
futuras respuestas del backend sin una decisión explícita.

La política respalda RNF-07: la aplicación no debe recolectar ni almacenar datos personales reales.
Si en una semana posterior se agregan datos de inspecciones al backend, será necesario definir una
política específica antes de incluirlos en una caché.

## 6. Registro de errores y observabilidad

Los errores del registro en el cliente se escriben como `[pwa] registro fallido`. Los errores de
instalación se escriben como `[sw] instalación fallida`. Los errores al obtener archivos estáticos
se escriben como `[sw] cache-first request failed`, y los errores de navegación como
`[sw] navigation request failed`.

Después de un fallo de navegación, el Service Worker intenta la copia de la URL y finalmente
`/offline`. El registro en consola permite distinguir un problema de red de un problema de
instalación o de actualización.

## 7. Trade-offs y alternativas descartadas

Se eligió un Service Worker escrito directamente en `public/sw.js` en lugar de Workbox o `next-pwa`.
La solución manual ofrece control visible sobre cada ruta, no agrega dependencias y es compatible
con el flujo actual de Next 16, sin depender de un plugin externo para construir el worker.

Para HTML se eligió network-first en lugar de stale-while-revalidate. La primera estrategia intenta
mostrar datos actualizados y solo usa la copia local cuando la red falla. Stale-while-revalidate
mostraría primero una versión posiblemente antigua y actualizaría después, lo cual no es ideal para
un listado de inspecciones que el coordinador espera revisar con información reciente.

Cache-first sí se conserva para `/_next/static/**`, porque esos archivos son estáticos y sus nombres
versionados permiten reutilizarlos de forma segura.

## 8. Límites y riesgos conocidos

- El registro se limita a producción; en `next dev` se desactiva para no interferir con HMR.
- La instalación depende de que exista `/offline`; si la ruta falta, `cache.addAll` falla y el
  Service Worker no se instala.
- Safari e iOS tienen diferencias de soporte para instalación, almacenamiento y APIs de PWA; el
  objetivo principal es Chrome para Android y navegadores de escritorio.
- Si el usuario limpia el almacenamiento del navegador, pierde la copia local del App Shell y debe
  visitar de nuevo la aplicación con conexión.
- La captura y sincronización de inspecciones todavía no están implementadas.

Estos límites se relacionan con los riesgos del ADR-001:

- **R1:** versionar la caché y usar network-first para evitar servir una versión obsoleta de HTML.
- **R2:** la sincronización futura no depende todavía de Background Sync y requerirá una estrategia
  de reintento.
- **R3:** el soporte desigual de iOS/Safari obliga a declarar navegadores objetivo y degradar con
  elegancia.
- **R4:** limpiar el almacenamiento elimina datos locales; la futura cola deberá avisar sobre
  registros pendientes y sincronizar al volver la red.

## 9. Cómo verificarlo

Ejecutar desde la raíz del proyecto:

```bash
npm ci
npm run test -- --run
npm run build
npm start
```

La salida de build debe mostrar `/offline` como ruta estática. Con la aplicación abierta en
`http://localhost:3000`, abrir `DevTools -> Application -> Service Workers` y confirmar que `/sw.js`
está activo. En `Cache Storage` debe aparecer `inspecciones-v1` con `/`, `/offline`, el manifest y
los íconos.

Para la prueba offline:

1. Abrir `DevTools -> Network`.
2. Activar `Offline`.
3. Recargar `/` y comprobar que continúa visible `Inspecciones de laboratorio`.
4. Visitar una ruta no cacheada, como `/ruta-inexistente`.
5. Comprobar que se muestra la página `Sin conexión` de `/offline`.

Para la actualización controlada, cambiar temporalmente la versión a `inspecciones-v2`, ejecutar
de nuevo el build y reiniciar la aplicación. La nueva versión debe quedar en `waiting`; el aviso
`Hay una nueva versión disponible` debe mostrar el botón `Actualizar`. Solo al pulsarlo se envía
`SKIP_WAITING`, ocurre `controllerchange` y se recarga la página. Las pruebas automatizadas de
`tests/service-worker.spec.ts` y `tests/offline.spec.ts` cubren el precache, la invalidación, el
fallback y el registro seguro.
