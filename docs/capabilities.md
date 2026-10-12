# Capacidades del dispositivo y avisos de cambio — Semana 6

Actividad `w06-device-push`. Todo el contenido usa datos sintéticos.

## 1. Objetivo y alcance

Al capturar una inspección (formulario de la Semana 5 en `/inspecciones`) la persona puede, si quiere:

- **CAP-01** adjuntar una **foto de evidencia** del equipo, con la cámara en vivo o eligiendo una imagen;
- **CAP-02** adjuntar una **ubicación aproximada** (≈ 100 m);
- **CAP-03** recibir un **aviso de cambio** cuando una inspección se guarda, se sincroniza o entra en conflicto:
  siempre dentro de la página y, si activó los avisos, también como notificación del sistema;
- **CAP-04** ver un **push** entrante como notificación y volver a la aplicación al pulsarlo (service worker).

Reglas transversales: **CAP-05**, ningún permiso se pide al cargar, solo al pulsar el botón de cada
capacidad; **CAP-06**, la inspección se puede guardar y sincronizar con o sin evidencia, aunque falte
la API o se niegue el permiso.

Fuera de alcance: suscripción real a Web Push con servidor de envío, Background Sync y almacenamiento
de fotos en un backend (ver §9).

| Archivo | Responsabilidad |
| --- | --- |
| `src/lib/device/camera.ts` | Cámara en vivo (`getUserMedia`), validación, reducción y limpieza de la foto. |
| `src/lib/device/geolocation.ts` | Lectura única y aproximada de la ubicación, con límite de espera propio. |
| `src/lib/device/permissions.ts` | Consulta del estado de un permiso **sin** abrir el diálogo. |
| `src/lib/device/evidence.ts` | Tipo `InspectionEvidence` (foto y ubicación opcionales). |
| `src/lib/notifications/client.ts` | Permiso de notificaciones, canal del aviso y textos de los avisos. |
| `src/components/evidence-capture.tsx` | Bloque «Evidencia opcional» del formulario. |
| `src/components/notification-preferences.tsx` | Estado de los avisos y botón «Activar avisos». |
| `src/components/inspection-capture-client.tsx` | Integra la evidencia y los avisos con la cola de la Semana 5. |
| `public/sw.js` | Eventos `push` y `notificationclick` (el resto del worker no cambia). |
| `tests/capabilities.spec.ts` | 74 pruebas de comportamiento (CAP-01 a CAP-06). |
| `scripts/check-capabilities-browser.mjs` | Comprobación opcional en Chromium real; resultado en `reports/capabilities-browser.json`. |

Historia del incremento: Cleber hizo la primera versión de cámara y ubicación (`62f9c36`) y Benkis la
del cliente de notificaciones (`b37c1e7`). Carlos integró las capacidades al formulario, cambió el
fallback (§6.1), agregó privacidad, push en el worker, pruebas y esta documentación. Se conservaron las
funciones públicas de notificaciones de Benkis y su prueba `tests/notifications.spec.ts`.

## 2. Permisos mínimos: cuándo y qué se pide

| Capacidad | API | Momento en que se pide | Qué se pide exactamente | Lo que nunca se hace |
| --- | --- | --- | --- | --- |
| Foto (selector) | `<input type="file">` | No requiere permiso | Una imagen elegida por la persona | Acceder a la cámara desde la página |
| Foto (en vivo) | `getUserMedia` | Clic en «Abrir cámara» | Solo video, sin audio; cámara trasera preferida; 1280 × 720 ideal | Pedir micrófono; dejar la cámara encendida |
| Ubicación | `geolocation.getCurrentPosition` | Clic en «Agregar ubicación aproximada» | Una lectura, `enableHighAccuracy: false`, `timeout` 10 s, `maximumAge` 5 min | `watchPosition` (seguimiento) |
| Notificaciones | `Notification.requestPermission` | Clic en «Activar avisos» | Permiso de notificaciones | Pedirlo al cargar; volver a preguntar si ya hubo decisión |

Antes de cualquier clic, `queryPermission` usa `navigator.permissions.query` para mostrar si la cámara o
la ubicación están bloqueadas, sin abrir ningún diálogo. Si el navegador no reconoce el nombre (Firefox y
Safari con `camera`), el estado es `unknown` y no se muestra nada.

La cámara se apaga (se detienen todos los tracks) al capturar, al pulsar «Cerrar cámara», al ocultar la
pestaña, al desmontar el formulario y también cuando el permiso llega después de que el formulario dejó
de existir.

## 3. Fallback: la inspección siempre se puede guardar

| Situación | Comportamiento | Prueba |
| --- | --- | --- |
| Sin `getUserMedia` o contexto no seguro (HTTP) | No aparece «Abrir cámara»; «Elegir imagen» sigue disponible | CAP-01, CAP-05 |
| Permiso de cámara negado (`NotAllowedError`, `SecurityError`) | Mensaje y «Elegir imagen»; aviso «bloqueada para este sitio» | CAP-01, CAP-05, Chromium |
| Sin cámara (`NotFoundError`, `OverconstrainedError`) o cámara ocupada (`NotReadableError`) | Mensaje con la alternativa | CAP-01 |
| Diálogo de cámara sin responder | La promesa sigue pendiente, pero «Elegir imagen» y la ubicación siguen habilitadas | CAP-05, Chromium |
| Sin `createImageBitmap` o canvas | No se adjunta foto: nunca se guarda la imagen original sin limpiar | CAP-01 |
| Archivo vacío, GIF, SVG o de más de 10 MB | Se rechaza antes de decodificar | CAP-01 |
| Resultado mayor de 1 MB o que no es JPEG | Se rechaza con mensaje | CAP-01 |
| Sin geolocalización o contexto no seguro | Se guarda sin ubicación; no se inventan coordenadas | CAP-02 |
| Ubicación negada (1), no disponible (2) o vencida (3) | Mensaje; se puede reintentar o guardar sin ubicación | CAP-02, Chromium |
| Diálogo de ubicación sin responder | El límite propio de 20 s responde «tardó demasiado» | CAP-02, Chromium |
| Sin API de notificaciones, sin decisión o con permiso negado | Solo el aviso dentro de la página (`aria-live`) | CAP-03, CAP-05 |
| Chrome para Android sin worker (`new Notification()` lanza `TypeError`) | Solo el aviso dentro de la página | CAP-03 |
| `npm run dev` (sin worker) con permiso concedido | Notificación con el constructor de página | CAP-03 |

## 4. Privacidad y datos recolectados

- **Foto.** Se vuelve a codificar en un canvas como JPEG (calidad 0.8) con el lado mayor de máximo
  1280 px y un tope de 1 MB. Ese paso descarta los metadatos EXIF, que pueden incluir coordenadas GPS,
  modelo del teléfono y fecha. En Chromium se comprobó con un JPEG que traía un bloque EXIF sintético:
  la foto guardada ya no lo contiene (`reports/capabilities-browser.json`). No se guarda el nombre del
  archivo. La interfaz recuerda fotografiar solo equipos o instalaciones, nunca personas
  (`docs/requirements.md`, §5).
- **Ubicación.** Se redondea a 3 decimales (≈ 110 m) y la precisión declarada nunca baja de 100 m.
  Basta para ubicar el edificio del laboratorio, no a una persona. Es una lectura única, opcional y se
  puede quitar antes de guardar.
- **Avisos.** Solo incluyen el laboratorio y el estado; nunca el responsable ni el resumen, porque una
  notificación puede verse en la pantalla bloqueada. Cada aviso usa un `tag` para reemplazar al anterior
  en lugar de acumularse.
- **Dónde viven los datos.** La evidencia viaja dentro de la mutación de la Semana 5: se guarda en
  IndexedDB hasta sincronizar y se envía a `POST /api/inspecciones`, que es una demostración en memoria y
  no guarda la evidencia. Nada se envía a terceros. El repositorio no contiene claves ni credenciales.
- **Datos sintéticos.** Las pruebas sustituyen cada API por dobles con datos inventados. Para una
  demostración se usa una ubicación sintética en DevTools → Sensors, una imagen sintética (por ejemplo
  `public/icons/icon-512x512.png`) o la cámara falsa de Chromium.

## 5. Avisos de cambio y push

`notifyChange` intenta, en este orden:

1. `ServiceWorkerRegistration.showNotification`: es la única vía en Chrome para Android y permite que el
   worker reciba el clic.
2. `new Notification()`: escritorio sin worker registrado (el worker solo se registra en producción).
3. Si ambos fallan o no hay permiso, el aviso queda únicamente en la página. La función nunca lanza.

Se usa `navigator.serviceWorker.getRegistration()` y no `.ready`, porque `.ready` nunca se resuelve si
no hay un worker registrado y el aviso quedaría esperando para siempre.

En `public/sw.js`:

- `push` acepta JSON `{ title, body, tag, url }` o texto plano (el botón **Push** de DevTools envía texto).
  Recorta título (80), cuerpo (160) y `tag` (64), y solo acepta rutas del mismo origen: una URL externa se
  reemplaza por `/inspecciones` para que un push no pueda abrir otro sitio.
- `notificationclick` cierra el aviso y enfoca la pestaña abierta en esa ruta o, si no existe, abre una.

No hay suscripción (`pushManager.subscribe`) ni servidor de envío: requeriría un par de claves VAPID cuya
parte privada no puede vivir en el repositorio y un backend que guarde suscripciones. El worker ya sabe
mostrar un push entrante; los pasos para completarlo están en §9.

## 6. Decisiones y alternativas descartadas

### 6.1 Fallback: continuar sin la capacidad en vez de inventar datos

La primera versión devolvía, cuando faltaba la API, una imagen de 1 × 1 px y las coordenadas de la
universidad marcadas como `success: true`. Se descartó porque mezcla datos inventados con datos medidos:
la coordinación no podría distinguir una inspección con ubicación real de otra con una ubicación falsa,
y el análisis por laboratorio quedaría sesgado. Ahora el fallback es guardar la inspección **sin** esa
evidencia y explicarlo en pantalla. Los datos sintéticos se quedan donde corresponden: en las pruebas y
en las herramientas de demostración.

### 6.2 Otras decisiones

| Decisión | Alternativa descartada | Motivo | Costo aceptado |
| --- | --- | --- | --- |
| Selector de archivo siempre disponible + cámara en vivo opcional | Solo `getUserMedia` | El selector no pide permiso a la página, funciona en escritorio e iOS y es el fallback natural | Dos caminos que probar |
| Volver a codificar la foto | Guardar el archivo original | Quita EXIF/GPS y limita tamaño | Se pierde calidad; GIF y SVG no se admiten |
| Data URL dentro de la mutación | `Blob` en IndexedDB y envío multipart | La cola y el endpoint de la Semana 5 ya usan JSON | Base64 ocupa ≈ 33 % más; por eso el tope de 1 MB |
| `getCurrentPosition` aproximado | `watchPosition` o alta precisión | Una lectura basta para una inspección; menos batería y menos datos personales | Puede caer en el edificio vecino |
| Límite propio de 20 s para la ubicación | Confiar en `timeout` | `timeout` no corre mientras el diálogo de permiso sigue abierto | Un mensaje de espera más |
| Worker primero, constructor después | Solo `new Notification()` | En Android el constructor lanza `TypeError` | Dos caminos que probar |
| Aviso del sistema aunque la pestaña esté visible | Solo con la pestaña oculta | El cambio se puede verificar en una demostración; el `tag` evita acumulación | Puede ser redundante con el aviso de la página |
| Inyección de dependencias (`env`, `codec`, `devices`) | Simular globales en cada prueba | Pruebas deterministas sin navegador | Parámetros opcionales extra |

## 7. Trazabilidad

| Requisito | Código | Pruebas (`tests/capabilities.spec.ts`) |
| --- | --- | --- |
| CAP-01 Foto opcional con permisos mínimos, limpieza y límites | `camera.ts`, `evidence-capture.tsx` | «CAP-01 cámara en vivo…», «CAP-01 foto: validación…», «adaptadores del navegador» |
| CAP-02 Ubicación aproximada con fallback | `geolocation.ts`, `evidence-capture.tsx` | «CAP-02 ubicación aproximada…», «adaptadores del navegador» |
| CAP-03 Aviso de cambio con canal de respaldo | `notifications/client.ts`, `notification-preferences.tsx` | «CAP-03 avisos de cambio…», `tests/notifications.spec.ts` |
| CAP-04 Push y clic en avisos | `public/sw.js` | «CAP-04 service worker: push y clic en avisos» |
| CAP-05 Permisos solo bajo acción de la persona | `evidence-capture.tsx`, `notification-preferences.tsx`, `permissions.ts` | «CAP-05 interfaz…», «CAP-05 consulta de permisos…» |
| CAP-06 Flujo útil con y sin capacidades | `inspection-capture-client.tsx` | «CAP-06 integración con la captura offline…» |

`npm test` exige cobertura mínima en `src/lib/device/**` y `src/lib/notifications/**` (95 % de líneas,
sentencias y funciones; 90 % de ramas). Resultado actual: 100 % de líneas y funciones, 97 % de ramas.

## 8. Cómo verificarlo

**Automático (igual que CI):**

```bash
npm ci
make verify            # en Windows sin make: npm run verify
npm test               # Vitest + cobertura; escribe coverage/ y test-results/junit.xml
npm run build
bash public-tests/check.sh
```

**Navegador real (opcional):** con `npm run build` y `npm start` en una terminal, en otra:

```bash
npm i --no-save playwright && npx playwright install chromium
npm run check:capabilities-browser
```

Comprueba 22 escenarios en Chromium (cámara falsa, ubicación sintética, permisos negados, diálogos sin
responder, push y modo sin red) y guarda `reports/capabilities-browser.json` y capturas en `evidence/s06/`.

**Manual en Chrome o Edge:**

1. `npm run build` y `npm start`; abre <http://localhost:3000/inspecciones>. No debe aparecer ningún diálogo de permiso.
2. Pulsa **Activar avisos** y acepta. El texto cambia a «Avisos del sistema activados…».
3. En DevTools → ⋮ → More tools → **Sensors**, elige una ubicación personalizada sintética (por ejemplo
   `10.0000, -20.0000`). Pulsa **Agregar ubicación aproximada**: aparece `10.000, -20.000` con una precisión
   declarada de al menos ±100 m.
4. Pulsa **Abrir cámara**, acepta y luego **Capturar foto**: el indicador de cámara del navegador se apaga.
5. Pulsa **Quitar foto** y luego **Elegir imagen** con `public/icons/icon-512x512.png`: «Foto adjunta: 512 × 512 px…».
6. Pulsa **Guardar sin conexión**: aparecen el aviso en la página y las notificaciones «Inspección guardada» y «Sincronización completada».
7. DevTools → Application → **Service workers** → campo **Push**: escribe
   `{"title":"Revisión pendiente","body":"Laboratorio de Redes","url":"/inspecciones"}` y pulsa **Push**. Al pulsar la notificación se enfoca `/inspecciones`.
8. En el candado de la barra de direcciones bloquea cámara y ubicación y recarga: los botones explican la alternativa y la inspección se guarda igual.
9. En DevTools → Network marca **Offline**, guarda una inspección (queda pendiente) y vuelve a **Online**: se sincroniza y llega el aviso.

## 9. Límites y riesgos conocidos

- **Push real.** Falta la suscripción y el servidor de envío. Para completarlo: generar un par VAPID y
  guardar la clave privada solo en variables de entorno del servidor; exponer la clave pública al cliente;
  pedir `pushManager.subscribe` tras «Activar avisos»; guardar la suscripción en un endpoint autenticado;
  enviar con una biblioteca Web Push y borrar suscripciones que respondan 404/410.
- **iOS y Safari.** En iOS las notificaciones web solo funcionan con la PWA instalada en la pantalla de
  inicio (iOS 16.4 o posterior). Safari anterior a 15 no tiene `createImageBitmap`: no se puede adjuntar
  foto. Firefox y Safari no permiten consultar el permiso `camera` (estado `unknown`).
- **Contexto seguro.** Cámara y ubicación requieren HTTPS o `localhost`. Si se abre desde otro equipo por
  `http://IP:3000`, la cámara en vivo no se ofrece y la ubicación responde con el mensaje de contexto no seguro.
- **Servidor de demostración.** `POST /api/inspecciones` no guarda ni valida la evidencia. Un backend real
  debe validar tipo, tamaño y precisión y guardar la foto fuera del JSON.
- **Alcance de las pruebas.** jsdom y los dobles no reproducen hardware real; por eso existen la
  comprobación en Chromium (dispositivos falsos) y la prueba manual. Los umbrales de cobertura solo
  aplican a `src/lib/device` y `src/lib/notifications`.
- **Dependencias.** `npm audit` ya reportaba antes de esta semana avisos críticos en `next` 16.3.4
  (corregidos en 16.3.8) y en `vitest` 3.x. No se actualizaron en este incremento para no mezclar
  cambios; queda como tarea del equipo.

## 10. Fallos encontrados y corregidos

1. **Formulario de la Semana 5.** `save()` llamaba `event.currentTarget.reset()` después de un `await`.
   React limpia `currentTarget` al terminar el despacho, así que lanzaba `TypeError`: la inspección quedaba
   en IndexedDB, pero el formulario no se reiniciaba, la lista no se actualizaba y no se sincronizaba
   hasta recargar. Se guarda la referencia al formulario antes del primer `await`; lo cubre la prueba de
   regresión de CAP-06.
2. **`getUserMedia` sin `this`.** Al extraer el método de `navigator.mediaDevices` el navegador lanza
   «Illegal invocation»; se llama con `.call(mediaDevices, …)`. Hay prueba.
3. **Carrera de permisos.** La consulta de permisos podía terminar después de un clic y borrar un rechazo
   ya observado; ahora se combinan. Hay prueba.
4. **Diálogo de cámara sin responder.** Bloqueaba todo el bloque de evidencia y, si el permiso llegaba con
   el formulario ya desmontado, la cámara quedaba encendida. Se separaron los estados de espera y se
   detiene ese stream; del mismo modo, una foto o ubicación que termina después de guardar ya no se
   adjunta a la siguiente inspección. Hay pruebas y comprobación en Chromium.
5. **Diálogo de ubicación sin responder.** Sin el límite propio la promesa no terminaba; ahora responde a
   los 20 s (medido en Chromium).
