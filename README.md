# PWA de inspecciones de laboratorio — proyecto base

Starter oficial para la materia **Aplicaciones Web Progresivas**.

## 1. Setup

Para preparar el entorno de desarrollo local, asegúrate de cumplir con los siguientes requisitos e instalar las dependencias:

- **Node.js**: Versión 20 LTS o superior.
- **npm**: Versión 10 o superior.
- **Git** y una cuenta de GitHub.

**Instalación:**
Clona este repositorio y ejecuta el siguiente comando en la raíz del proyecto para instalar las dependencias exactas:
```bash
npm ci
```

## 2. Ejecución

Para levantar el servidor de desarrollo y visualizar la aplicación, ejecuta:
```bash
npm run dev
```
Abre <http://localhost:3000> en tu navegador. Deberías ver la pantalla inicial de inspecciones con datos sintéticos (Laboratorio de Redes, Electrónica y Software).

## 3. Verificación

Antes de enviar cualquier cambio, asegúrate de que el proyecto cumple con los estándares mediante los siguientes comandos:

**Verificación automática (linter, build y pruebas):**
```bash
npm run verify
npm test
npm run build
```

**Verificación pública del starter:**
```bash
bash public-tests/check.sh
```
Estos comandos comprueban que el código compila correctamente y la estructura general es válida. `make verify` o `npm run verify` genera `reports/verification.json`.

Además, para verificar la PWA: abre **Chrome DevTools -> Application -> Manifest** y comprueba que el archivo `manifest.webmanifest` carga sin errores y la PWA es instalable.

## 4. Evidencia

La evidencia individual del trabajo técnico realizado se encuentra en la carpeta `evidence/`.
- **Archivo principal:** `evidence/individual.md`

Este archivo documenta la contribución de la semana, con la decisión técnica tomada por cada integrante, las pruebas ejecutadas, limitaciones encontradas y el uso transparente de herramientas de IA durante el desarrollo. No uses datos reales de personas o laboratorios; usa datos sintéticos.

## Semana 3 — Service worker y consulta offline

La aplicación conserva la lista de inspecciones sintéticas disponible sin conexión después de una primera visita con red, y avisa al usuario cuando hay una versión nueva. La estrategia completa y sus justificaciones están en [`docs/cache-strategy.md`](docs/cache-strategy.md).

### Qué se agregó

| Artefacto | Función |
| --- | --- |
| `public/sw.js` | Service Worker escrito a mano: precache atómico en una caché versionada, cache-first para `/_next/static/**`, network-first con respaldo `/offline` para navegaciones y activación solo bajo mensaje `SKIP_WAITING`. |
| `src/lib/pwa/register-service-worker.ts` | Registro seguro: solo en producción, nunca lanza, avisa de actualizaciones y activa el worker en espera con una única recarga. |
| `src/components/pwa/ServiceWorkerManager.tsx` | Componente de cliente montado en `layout.tsx`: registra el worker y muestra el aviso de nueva versión. |
| `src/app/offline/page.tsx` | Ruta `/offline` (página «Sin conexión»), precacheada por el worker. |
| `docs/cache-strategy.md` | Estrategia de caché en 9 secciones: recursos, ciclo de vida, invalidación, privacidad, errores, alternativas, límites y verificación. |
| `tests/service-worker.spec.ts`, `tests/offline.spec.ts` | Suites Vitest del worker y del registro; usan el arnés `tests/helpers/sw-harness.ts`, que ejecuta el `public/sw.js` real con caché y red simuladas. |
| `.github/workflows/week-03-w03-service-worker-offline.yml` | Workflow de retroalimentación de la semana; se suma a los de las semanas 1 y 2. |
| `scripts/verify.mjs`, `public-tests/check.sh` | Ahora exigen también los artefactos de la Semana 3. |

### Setup y ejecución

```bash
npm ci
npm run build
npm start
```

Abre <http://localhost:3000>. El Service Worker **solo se registra en producción**, para no interferir con la recarga en caliente de `next dev`; por eso hay que compilar y usar `npm start`. Con `npm run dev` la aplicación funciona igual, pero sin worker.

Si ya probaste la versión de producción en `localhost:3000` y vuelves a `npm run dev`, el worker anterior sigue registrado en ese origen y puede servir archivos de una compilación vieja. Antes de continuar, en **DevTools → Application → Service Workers** pulsa **Unregister** y en **Storage** usa **Clear site data**.

### Verificación

```bash
npm ci
npm run verify
npm run test -- --run
npm run build
bash public-tests/check.sh
```

Todas deben terminar sin errores. Las pruebas son deterministas: no usan navegador ni red real. `check.sh` necesita ripgrep (`rg`) instalado; en Linux, como en CI, viene disponible.

### Prueba manual offline

1. Ejecuta `npm run build` y `npm start`, y abre <http://localhost:3000> en Chrome o Edge (ventana normal, no incógnito).
2. Abre DevTools con F12 → **Application → Service Workers** y confirma que `/sw.js` figura como *activated and is running*. Si no aparece, recarga una vez.
3. En **Application → Cache Storage → `inspecciones-v1`** deben estar `/`, `/offline`, `/manifest.webmanifest` y los tres íconos.
4. En **Network** activa **Offline**.
5. Recarga `/`. La portada con la lista de inspecciones sigue visible, servida desde la caché. En la consola aparece `[sw] navigation request failed`: es esperado y deja constancia del fallo de red.
6. Abre una ruta que nunca visitaste, por ejemplo <http://localhost:3000/ruta-inexistente>. Se muestra la página **Sin conexión** con el botón «Volver a la portada».
7. Desactiva **Offline** y recarga: la página vuelve a cargarse desde la red.

### Aviso de actualización

Cuando existe una versión nueva del worker y la página ya estaba controlada por la anterior, aparece abajo a la izquierda un aviso oscuro con el texto «Hay una nueva versión disponible.» y el botón blanco **Actualizar**. Nada se activa hasta que el usuario lo pulsa.

Para verlo:

1. Con la aplicación abierta desde `npm start`, cambia en `public/sw.js` la constante `CACHE_VERSION` a `inspecciones-v2`.
2. Ejecuta de nuevo `npm run build`, reinicia `npm start` y recarga la pestaña abierta.
3. El worker nuevo queda en estado *waiting* (visible en **Application → Service Workers**) y aparece el aviso.
4. Pulsa **Actualizar**: se envía `SKIP_WAITING`, la página se recarga una sola vez y en **Cache Storage** queda únicamente `inspecciones-v2`.
5. Revierte el cambio de `CACHE_VERSION` si solo era una prueba.

### Supuestos y límites

- **Datos y privacidad.** Solo se guardan HTML, scripts, estilos e íconos públicos con datos sintéticos. El worker no intercepta `/api/**`, métodos distintos de `GET` ni solicitudes de otro origen, y no guarda respuestas con error ni con `Cache-Control: no-store`.
- **Alcance.** Solo hay lectura offline. Capturar inspecciones sin conexión y sincronizarlas después (RF-05 y RF-06) queda para semanas posteriores.
- **Instalación atómica.** Si falta cualquier recurso del precache, incluida `/offline`, el worker no se instala. Cambiar `PRECACHE_URLS` obliga a subir `CACHE_VERSION`.
- **La ruta `/` no se refresca con red (comprobado).** Con `npm start`, `/` responde `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`, porque es dinámica desde la Semana 2 (recibe `searchParams`). Como el worker no guarda respuestas `no-store`, la copia offline de `/` es la que se tomó al instalar el worker y solo cambia cuando se instala una versión nueva. Las variantes `/?state=…` tampoco quedan en caché. `/offline` y `/_next/static/**` sí son cacheables. Queda una decisión de equipo: volver `/` estática (RNF-04) o ajustar la regla de `no-store`.
- **Alcance de las pruebas.** El arnés ejecuta el worker real en `node:vm` con una caché y una red simuladas. Es rápido y determinista, pero no reproduce `Vary`, la cuota de almacenamiento, respuestas opacas ni el ciclo de vida real del navegador; por eso existe la prueba manual de arriba.
- **Navegadores.** El objetivo es Chrome y Edge (escritorio y Android). Safari e iOS tienen soporte desigual (riesgo R3 del ADR-001).
- **Datos del sitio.** Si el usuario limpia el almacenamiento del navegador, pierde la copia local y debe visitar la aplicación de nuevo con conexión.

### Evidencia de la Semana 3

| Campo | Valor |
| --- | --- |
| Tag y SHA de entrega | `s03-entrega` — `<pendiente>` |
| Actions | <https://github.com/Chocotzi/PWA-10B-E03/actions> (archivo `week-03-w03-service-worker-offline.yml`; en la lista aparece con el mismo nombre que el de la Semana 2) |
| Evidencia individual | [`evidence/individual.md`](evidence/individual.md) |
| Estrategia de caché | [`docs/cache-strategy.md`](docs/cache-strategy.md) |
| Pruebas | [`tests/service-worker.spec.ts`](tests/service-worker.spec.ts), [`tests/offline.spec.ts`](tests/offline.spec.ts) |

