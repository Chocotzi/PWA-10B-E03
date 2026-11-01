# Modelo de amenazas · PWA de inspecciones de laboratorio (Semana 9)

> Estado: **borrador de la Tarea 1 (Benkis)**. Las filas T-05 a T-14 se completan con los controles y
> pruebas de Carlos (cabeceras, credenciales, dependencias, service worker) y Cleber (privacidad).
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
| T-05 | XSS e inyección de scripts | T | CSP, escape de React, MIME de la foto validado en servidor | Pendiente | Carlos | Pendiente |
| T-06 | Clickjacking y sniffing de MIME | T | `frame-ancestors`, `X-Content-Type-Options` | Pendiente | Carlos | Pendiente |
| T-07 | Notificación push que abre un sitio externo | S | Solo rutas del mismo origen | Pendiente | Carlos | Pendiente |
| T-08 | Credenciales en el repositorio o en el bundle | I | Escáner, `.gitignore`, sin variables públicas sensibles | Pendiente | Carlos | Pendiente |
| T-09 | Dependencia vulnerable o scripts de instalación | T | `npm audit`, `--ignore-scripts`, lockfile, Dependabot | Pendiente | Carlos | Pendiente |
| T-10 | Cachear respuestas sensibles en el service worker | I | `/api` y `no-store` excluidos | Pendiente | Carlos | Pendiente |
| T-11 | Permisos excesivos del dispositivo | E | `Permissions-Policy` y solicitud solo tras un clic | Pendiente | Carlos | Pendiente |
| T-12 | Datos locales visibles en equipo compartido | I | Minimización, borrado local, aviso | Pendiente | Cleber | Pendiente |
| T-13 | Exposición de datos personales (foto, responsable, ubicación) | I | Inventario, EXIF fuera, ubicación redondeada | Pendiente | Cleber | Pendiente |
| T-14 | Repudio: no hay bitácora de quién hizo qué | R | Límite declarado: sin autenticación en el curso | Pendiente | Cleber | Pendiente |

## 6. Decisiones y supuestos de la Tarea 1

- **Validación manual sin dependencias.** Evita añadir una librería de esquemas y el riesgo de desincronizar
  `package-lock.json` (ya causó un fallo de `npm ci` en la Semana 8). Costo: más código propio que mantener.
- **Rechazo de claves desconocidas** en lugar de ignorarlas: una clave extra puede ser un intento de contaminar
  prototipos o de colar campos que otra capa interprete.
- **Los errores indican el campo y el motivo, nunca el valor.** Evita reflejar contenido hostil o personal.
- **Comprobación de origen laxa si no hay cabeceras.** Las llamadas sin `Origin` ni `Sec-Fetch-Site` (curl, pruebas)
  se aceptan, porque el riesgo CSRF solo existe en navegadores, que siempre envían al menos una de las dos.
- **Mapas acotados con expulsión del más antiguo.** Un atacante podría expulsar confirmaciones antiguas y provocar
  que un reenvío se trate como nuevo; se acepta porque el servidor es solo de demostración y en memoria.

## 7. Límites y fallos conocidos

- La API sigue siendo de demostración: sin persistencia ni autenticación, de modo que cualquier cliente del mismo
  origen puede escribir y no hay limitación de tasa por cliente.
- El tope de 2 MiB por cuerpo se aplica al leer el flujo; el servidor de Next.js puede haber almacenado ya parte
  del cuerpo antes de llegar al manejador.
- La validación de foto comprueba prefijo, alfabeto base64 y tamaño, **no** decodifica la imagen ni valida los
  bytes JPEG.
- Las pruebas de esta tarea se ejecutaron con un arnés propio por limitaciones del entorno de desarrollo; la
  confirmación oficial es la ejecución de Vitest en GitHub Actions.
