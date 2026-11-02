# Modelo de amenazas · PWA de inspecciones de laboratorio (Semana 9)

> Estado: **versión final** con las tres tareas integradas: Tarea 1 (Benkis, T-01 a T-04), Tarea 2 (Carlos,
> T-05 a T-11 y sección 8) y Tarea 3 (privacidad, T-12 a T-14 y sección 7; asignada a Cleber y realizada por Benkis).
> Todos los datos del proyecto son **sintéticos**; no hay cuentas, autenticación ni datos reales.

## 1. Alcance

Dentro del alcance: la PWA Next.js (páginas `/` e `/inspecciones`), el service worker `public/sw.js`, la API
`/api/inspecciones` (lectura y escritura de demostración), el almacenamiento local (IndexedDB) y la evidencia
opcional (foto JPEG y ubicación aproximada).

Fuera del alcance: infraestructura de hosting, red del usuario, un backend persistente real, autenticación y
autorización (el curso no las incluye; ver T-14) y cualquier dato personal real.

## 2. Activos

| Activo | Por qué importa |
| --- | --- |
| Registros de inspección (laboratorio, responsable, resumen, hallazgos) | Integridad: base de decisiones de mantenimiento. |
| Evidencia (foto, ubicación redondeada) | Puede revelar personas, espacios o posición. |
| Cola local de mutaciones (IndexedDB) | Contiene datos aún no sincronizados en el equipo del usuario. |
| Disponibilidad de la API | La captura offline depende de que la sincronización no se degrade. |
| Memoria del servidor (mapas de revisiones y confirmaciones) | Un crecimiento sin límite agota el proceso. |

## 3. Actores

- **Usuario legítimo** (técnico de laboratorio) que captura inspecciones.
- **Atacante remoto** que envía solicitudes directas a `/api/inspecciones` (curl, scripts).
- **Página maliciosa de otro origen** que intenta escribir en la API desde el navegador de la víctima.
- **Persona con acceso físico** a un equipo compartido.
- **Dependencia comprometida** en la cadena de suministro.

## 4. Fronteras de confianza

```
Navegador (UI React, IndexedDB)  ──►  Service worker (cache)  ──►  /api/inspecciones  ──►  Memoria del servidor
        no confiable                    confiable pero acotado        frontera de red            Maps acotados
```

| Frontera | Qué cruza | Regla |
| --- | --- | --- |
| Navegador → API | Mutación JSON (incluye foto en data URL) | Toda entrada es hostil hasta validarla en el servidor. La validación del cliente es solo comodidad. |
| Navegador ↔ service worker | Solicitudes y respuestas cacheables | `/api` y respuestas `no-store` no se cachean (Carlos, T-10). |
| API → memoria | Revisión y confirmación por mutación | Mapas con tope; nada se escribe antes de validar. |
| API → navegador | Respuestas y errores | Mensajes genéricos, sin eco de valores ni detalles internos. |

## 5. Amenazas, controles y pruebas

STRIDE: S suplantación · T manipulación · R repudio · I fuga de información · D denegación de servicio · E elevación.

| ID | Amenaza | STRIDE | Control | Prueba | Dueño | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| T-01 | Entrada maliciosa o malformada en la API (tipos, longitudes, claves extra, `__proto__`, foto no JPEG, coordenadas fuera de rango) | T | Esquema estricto en `src/lib/security/validation.ts`; se valida antes de tocar el estado | `tests/security.spec.ts` y `tests/integration/api-security.spec.ts` (pruebas `T-01 · …`) | Benkis | Implementado |
| T-02 | Cuerpos enormes y mapas sin límite | D | Tope real de bytes al leer el cuerpo (413), límites de foto, mapas acotados a 5000 entradas | Pruebas `T-02 · …` | Benkis | Implementado |
| T-03 | Fuga de detalles internos o eco de valores recibidos | I | Errores genéricos con código; los fallos de lectura ya no devuelven `error.message`; `Cache-Control: no-store` | Pruebas `T-03 · …` | Benkis | Implementado |
| T-04 | Escritura desde otro origen o con tipo de contenido inesperado | S | `Content-Type: application/json` (415) y comprobación `Sec-Fetch-Site` / `Origin` (403) | Pruebas `T-04 · …` | Benkis | Implementado |
| T-05 | XSS e inyección de scripts | T | CSP en todas las respuestas ([`headers.ts`](../src/lib/security/headers.ts), publicada por `next.config.mjs`): `default-src 'self'`, `script-src 'self' 'unsafe-inline'` sin `'unsafe-eval'` en producción, `object-src 'none'`, `base-uri` y `form-action 'self'`, `connect-src 'self'`, sin comodines ni dominios externos. React escapa el contenido (no hay `dangerouslySetInnerHTML`) y el servidor valida el MIME de la foto (T-01) | `tests/security.spec.ts` (`T-05 · …`) y [`tests/e2e/security-headers.pw.ts`](../tests/e2e/security-headers.pw.ts): cero violaciones al usar la captura y control negativo (un script inyectado no puede usar eval ni salir del origen) | Carlos | Implementado; riesgo residual por `'unsafe-inline'` (8.2) |
| T-06 | Clickjacking y sniffing de MIME | T | `frame-ancestors 'none'` y `X-Frame-Options: DENY`; `X-Content-Type-Options: nosniff` en todas las rutas; `Cross-Origin-Opener-Policy: same-origin` | `T-06 · …` y E2E (la aplicación dentro de un iframe queda bloqueada) | Carlos | Implementado |
| T-07 | Notificación push que abre un sitio externo | S | `public/sw.js` solo acepta rutas del mismo origen (`sameOriginPath`) al mostrar y al pulsar el aviso; cualquier otra URL se reemplaza por `/inspecciones` | `T-07 · …`: 9 URL hostiles (otro esquema, `//`, barras invertidas, `usuario@host`, espacio inicial, `javascript:`, `data:`) más un control con ruta propia | Carlos | Implementado (control de la Semana 6, con prueba de regresión nueva) |
| T-08 | Credenciales en el repositorio o en el bundle | I | [`scripts/scan-secrets.mjs`](../scripts/scan-secrets.mjs) con las reglas de [`secrets.ts`](../src/lib/security/secrets.ts) sobre el repositorio y sobre `.next/static`; `.gitignore` con `.env*`, llaves y credenciales; `src/` solo lee `NODE_ENV` (ninguna `NEXT_PUBLIC_*`) | `T-08 · …` (una muestra por regla, casi-credenciales y el repositorio completo sin falsos positivos) y dos etapas de CI | Carlos | Implementado |
| T-09 | Dependencia vulnerable o scripts de instalación | T | `npm ci --ignore-scripts` con lockfile; etapa `npm audit --omit=dev --audit-level=high`; [Dependabot](../.github/dependabot.yml) semanal para npm y Actions; token del workflow de solo lectura | Etapa de CI «Auditoría de dependencias». Primer hallazgo atendido: `next` 16.3.4 (críticos) → 16.4.3, commit `c45bfb8` (8.5) | Carlos | Implementado |
| T-10 | Cachear respuestas sensibles en el service worker | I | El worker no intercepta `/api/**` y no guarda respuestas `no-store`; la API responde `no-store` y una regla de `next.config.mjs` lo garantiza; `/sw.js` se revalida (`no-cache`) con una CSP propia | `T-10 · …` (con y sin red, cinco variantes de `no-store`, ruta de API codificada) y E2E de encabezados | Carlos | Implementado |
| T-11 | Permisos excesivos del dispositivo | E | `Permissions-Policy`: `camera=(self)`, `geolocation=(self)`, `microphone=()` y otras APIs sensibles denegadas, sin delegación a iframes externos; los permisos se piden solo tras un clic (Semana 6) | `T-11 · …` y E2E: la página ve cámara y ubicación permitidas, y el micrófono bloqueado aunque el permiso esté concedido | Carlos | Implementado |
| T-12 | Datos locales visibles en equipo compartido | I | Botón «Borrar datos locales» con confirmación (`purgeLocalData`), aviso corto, minimización | `T-12 · …` en `tests/security.spec.ts` y `tests/integration/privacy.spec.ts` | Cleber (hecho por Benkis) | Implementado |
| T-13 | Exposición de datos personales (responsable, resumen, foto, ubicación) | I | Inventario tipado como fuente única, `redactForLog`, foto recodificada sin EXIF, ubicación redondeada, notificaciones sin datos personales | `T-13 · …` en `tests/security.spec.ts`; `tests/capabilities.spec.ts` | Cleber (hecho por Benkis) | Implementado |
| T-14 | Repudio: no hay bitácora de quién hizo qué | R | Límite declarado: sin autenticación en el curso; la bitácora futura debe pasar por `redactForLog` | Sin prueba (riesgo aceptado) | Cleber (hecho por Benkis) | Aceptado |

## 6. Decisiones y supuestos (Tareas 1 y 3)

- **Validación manual sin dependencias.** Evita añadir una librería de esquemas y el riesgo de desincronizar
  `package-lock.json` (ya causó un fallo de `npm ci` en la Semana 8). Costo: más código propio que mantener.
- **Rechazo de claves desconocidas** en lugar de ignorarlas: una clave extra puede ser un intento de contaminar
  prototipos o de colar campos que otra capa interprete.
- **Los errores indican el campo y el motivo, nunca el valor.** Evita reflejar contenido hostil o personal.
- **Comprobación de origen laxa si no hay cabeceras.** Las llamadas sin `Origin` ni `Sec-Fetch-Site` (curl, pruebas)
  se aceptan, porque el riesgo CSRF solo existe en navegadores, que siempre envían al menos una de las dos.
- **Mapas acotados con expulsión del más antiguo.** Un atacante podría expulsar confirmaciones antiguas y provocar
  que un reenvío se trate como nuevo; se acepta porque el servidor es solo de demostración y en memoria.
- **Inventario en código, no solo en Markdown.** La prueba compara el inventario con las claves que la validación
  admite, así que no se puede agregar un campo sin documentarlo.
- **Bitácoras redactadas por nombre de clave.** Es simple y predecible; no detecta datos personales escritos en campos
  libres no marcados.
- **Borrado local con confirmación en la página** en lugar de `window.confirm`: es accesible, se anuncia con
  `aria-live` y se puede probar sin diálogos del navegador.

## 7. Riesgos residuales

| Riesgo | Por qué se acepta | Qué haría falta en producción |
| --- | --- | --- |
| IndexedDB sin cifrar | El navegador no ofrece cifrado con clave del usuario sin autenticación | Sesión con expiración y borrado automático; cifrado con clave derivada del inicio de sesión |
| Memoria del servidor sin persistencia | Endpoint de demostración | Base de datos con tabla de deduplicación y retención definida |
| Sin autenticación ni bitácora (T-14) | Fuera del alcance del curso | Identidad, autorización por rol y bitácora redactada |
| Sin limitación de tasa | Endpoint de demostración | Límite por cliente o IP en el borde |
| Expulsión de confirmaciones antiguas | Tope de memoria de 5000 | Persistir las confirmaciones con su retención |

## 8. Tarea 2 (Carlos): navegador, secretos y dependencias

### 8.1 Encabezados que envía la aplicación

La política vive en [`src/lib/security/headers.ts`](../src/lib/security/headers.ts) y `next.config.mjs` la
publica con `headers()` para todas las rutas (páginas, API, estáticos y archivos de `public/`).

| Encabezado | Valor | Amenaza |
| --- | --- | --- |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` (en `next dev` se agrega `'unsafe-eval'`, que React usa para sus pilas de llamadas) | T-05, T-06 |
| `X-Content-Type-Options` | `nosniff` | T-06 |
| `Referrer-Policy` | `same-origin`: dentro del sitio se conserva la URL; a otros sitios no se envía nada | T-13 |
| `Permissions-Policy` | `camera=(self), geolocation=(self), microphone=(), display-capture=(), payment=(), usb=(), serial=(), hid=(), browsing-topics=()` | T-11 |
| `Cross-Origin-Opener-Policy` | `same-origin` | T-06 |
| `X-Frame-Options` | `DENY` (respaldo de `frame-ancestors` para navegadores antiguos) | T-06 |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains`, solo en producción y solo si el proxy indica `X-Forwarded-Proto: https` | transporte |
| `Cache-Control` en `/api/**` | `no-store` (además del que ya pone cada handler) | T-10 |
| `/sw.js` | `Cache-Control: no-cache` y su propia CSP `default-src 'self'; script-src 'self'` | T-10, T-05 |

Además `poweredByHeader: false` quita `X-Powered-By: Next.js`. No se usa `upgrade-insecure-requests`: todas
las fuentes permitidas son del mismo origen, así que no hay contenido mixto que actualizar; el transporte lo
cubren HTTPS en el despliegue y HSTS.

### 8.2 Decisión: `'unsafe-inline'` frente a un nonce por petición

Next.js inserta en cada página varios scripts en línea con los datos de React Server Components. Para que la
CSP los acepte hay dos caminos:

| | Nonce por petición (`proxy.ts`) | `'unsafe-inline'` (elegido) |
| --- | --- | --- |
| Render | Todas las rutas dinámicas: Next.js solo pone el nonce al renderizar en cada petición | `/offline`, `/inspecciones` y `/_not-found` siguen estáticas (decisión de la Semana 4) |
| Service worker | El HTML guardado para usarse sin red trae un nonce fijo que se repite en cada recarga | Sin cambios |
| Protección ante XSS | Un script inyectado sin nonce no corre | Un script en línea inyectado corre |
| Complejidad | `proxy.ts`, cabecera por petición y layout dinámico | Una regla estática en `next.config.mjs` |

**Experimento (rama local, no integrado), con `next build && next start` y Chromium.** Se agregó un
`src/proxy.ts` con nonce según la guía de Next.js 16:

1. Sin forzar render dinámico, `/inspecciones` y `/offline` (estáticas) llegaron sin nonce y Chromium bloqueó
   11 y 10 scripts (3 en línea y los demás de `/_next/static`): la captura no se hidrata. `/` y el detalle
   (dinámicas) funcionaron.
2. Con `export const dynamic = "force-dynamic"` en el layout, las 7 rutas pasaron a dinámicas y hubo cero
   violaciones con red. Pero sin red el worker respondió `/inspecciones` desde su caché y **tres recargas
   seguidas usaron el mismo nonce**: offline el nonce deja de ser de un solo uso y no aporta lo que promete.

Por eso se eligió `'unsafe-inline'`. Lo que compensa la decisión, y que el control negativo del E2E comprueba:
sin `'unsafe-eval'` en producción, `script-src` sin dominios externos, `connect-src` e `img-src` limitados al
propio origen (un script inyectado no puede cargar código ni enviar datos fuera), `object-src 'none'`,
`base-uri` y `form-action` cerrados. La primera defensa contra XSS sigue siendo React, que escapa todo el
contenido, y la validación del servidor (T-01). La prueba `T-05 · decisión` falla si alguien agrega un nonce o
un hash sin volver dinámicas las páginas, porque eso haría que el navegador ignore `'unsafe-inline'`.
Revisar la decisión si la aplicación deja de precachear HTML o si Next.js ofrece hashes para sus scripts.

### 8.3 Una sola fuente para la política

`next.config.mjs` y `scripts/scan-secrets.mjs` corren en Node sin compilar y Node 20 (`.nvmrc`) no ejecuta
TypeScript. En lugar de duplicar la política en JavaScript, [`scripts/lib/import-ts.mjs`](../scripts/lib/import-ts.mjs)
quita los tipos de `headers.ts` y `secrets.ts` con el compilador `typescript` (ya es dependencia: Next.js lo
exige para compilar) y los importa sin escribir archivos. Por eso esos dos módulos no importan nada. Next.js
llama a `headers()` solo en `next build` y `next dev`; `next start` lee los encabezados de
`.next/routes-manifest.json` (comprobado: un `console.error` dentro de `headers()` no aparece al arrancar), así
que servir la aplicación no necesita `typescript`. La prueba «next.config.mjs publica exactamente
nextHeaderRules()» confirma que lo que Next.js recibe es lo mismo que prueban Vitest y el E2E. Se descartó
renombrar a `next.config.ts` porque `scan-secrets.mjs` tendría el mismo problema y el equipo ya usa `.mjs`.

### 8.4 Secretos en el repositorio y en el bundle

`npm run scan:secrets` revisa lo versionado y lo nuevo que git no ignora (lo que podría subirse), sin
`node_modules/`, lockfiles ni binarios; `npm run scan:secrets -- --bundle` revisa `.next/static` y las páginas
prerenderizadas después del build. Las reglas buscan claves de AWS, Google Cloud o Firebase, Azure Storage,
GitHub, npm, Slack, Stripe, Supabase, Twilio y con prefijo `sk-`, llaves privadas PEM, cadenas tipo JWT,
contraseñas dentro de URL, asignaciones de literales a nombres de credencial (en código o estilo `.env`) y
variables `NEXT_PUBLIC_*` con nombre sensible. Un archivo `.env`, `.pem` o de credenciales versionado se
reporta por su nombre. El reporte nunca muestra el valor completo, solo los primeros cuatro caracteres y la
longitud. Las pruebas arman sus muestras en tiempo de ejecución, así que el repositorio no contiene literales
con forma de credencial (tampoco los vería la protección de push de GitHub).

`public-tests/check.sh` del kit busca las palabras `secret`, `token`, `password` y `api_key` en todo el
repositorio. Esa búsqueda ya falla antes de esta tarea con el propio texto del curso («Sin secretos ni PII» en
`evaluation.json`, «secretos» en el enunciado) y con `js-tokens` en el lockfile, así que no distingue una
credencial de una palabra. El control con reglas de formato es `npm run scan:secrets`.

### 8.5 Dependencias: umbral y qué hacer con un hallazgo

- **Umbral.** CI falla si `npm audit --omit=dev` reporta un aviso `high` o `critical` en dependencias de
  producción (lo que llega al servidor o al navegador). `moderate` y `low` se muestran sin detener el pipeline.
  Las de desarrollo no bloquean: no se despliegan, `--ignore-scripts` impide que ejecuten código al instalarse y
  Dependabot propone sus actualizaciones.
- **Con un hallazgo:** (1) leer el aviso y confirmar si el código afectado se usa; (2) actualizar en una rama a
  la primera versión corregida (`npm install paquete@versión`, o `npm audit fix` sin `--force`), revisar que el
  diff del lockfile solo toque esos paquetes y correr el pipeline completo; (3) si no hay versión corregida,
  forzar una dependencia transitiva corregida con `overrides` o registrar aquí una excepción con paquete, aviso,
  motivo, mitigación y fecha de revisión, sin bajar el umbral para todo el proyecto.
- **Primer caso real.** Al agregar la etapa, `next` 16.3.4 tenía avisos críticos (ejecución remota de código en
  Image Optimization con SVG y en funciones `use cache`) y altos, `sharp` 0.35.4 y `source-map-js` 1.2.1 altos.
  Los avisos de `next` que llegan hasta 16.4.0 se corrigen desde 16.4.1; se actualizó a 16.4.3 con
  `eslint-config-next` en la misma versión (commit `c45bfb8`). Después: `npm audit --omit=dev` sin hallazgos,
  `npm ci` limpio, 224 pruebas y E2E en Chromium sin fallos.

### 8.6 Límites conocidos de la Tarea 2

- `'unsafe-inline'` deja correr un script en línea si alguien logra inyectarlo; la CSP limita lo que ese script
  puede hacer, no que corra. La CSP tampoco impide navegar a otro sitio (`location.href`), que es otra vía de
  fuga de datos.
- HSTS depende de que el proxy envíe `X-Forwarded-Proto: https`; en Vercel la plataforma ya envía HSTS por su
  cuenta ([documentación](https://vercel.com/docs/security/encryption)). Sin proxy no hay HTTPS, y el navegador
  ignora HSTS recibido por HTTP.
- `robots.txt` solo pide a los rastreadores que no recorran `/api/` ni `/inspecciones`; no es control de
  acceso, cualquiera puede leerlo y pedir esas rutas.
- El escáner usa reglas de formato, no entropía ni historial de git: no ve una contraseña sin dígitos
  (`correcthorsebatterystaple`), un valor YAML sin comillas ni un secreto que ya se borró pero sigue en un commit
  anterior. Si un secreto llegó a subirse, borrarlo no basta: hay que rotarlo.
- `npm audit` consulta la base de avisos en línea: su resultado cambia con el tiempo y necesita red. Por eso
  está en CI y no en `make verify`, que debe ser determinista.
- `npm audit` completo (con desarrollo) sigue reportando avisos en herramientas como Vite; quedan para los PR
  de Dependabot porque no se despliegan.
- Node 20, el de `.nvmrc`, terminó su soporte en abril de 2026 y ya no recibe parches de seguridad. Cambiar a
  Node 22 o 24 afecta a todo el equipo y a CI; queda como recomendación.
- Las comprobaciones en navegador corren solo en Chromium (no Safari ni Firefox) y no hay reporte de
  violaciones de CSP en producción (`report-to`): una violación real solo se vería en la consola del usuario.

## 9. Límites y fallos conocidos (Tareas 1 y 3)

- La API sigue siendo de demostración: sin persistencia ni autenticación, de modo que cualquier cliente del mismo
  origen puede escribir y no hay limitación de tasa por cliente.
- El tope de 2 MiB por cuerpo se aplica al leer el flujo; el servidor de Next.js puede haber almacenado ya parte
  del cuerpo antes de llegar al manejador.
- La validación de foto comprueba prefijo, alfabeto base64 y tamaño, **no** decodifica la imagen ni valida los
  bytes JPEG.
- Las pruebas de las Tareas 1 y 3 se ejecutaron con un arnés propio por limitaciones del entorno de desarrollo; la
  confirmación oficial es la ejecución de Vitest en GitHub Actions.
