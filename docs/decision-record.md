# ADR-001 — Estrategia de aplicación

> Registro de decisión de arquitectura. Relaciona restricciones, alternativas, consecuencias y una
> forma de validación.

## Estado

**Aceptada — 2026-09-06.** Equipo: Arriaga, Bolaños, Carbajal. Se revisará al cerrar la capa
offline (ver "Validación").

## Contexto y restricciones

- **Conectividad intermitente.** El trabajo ocurre dentro de laboratorios del campus (sótano de
  redes, salas apantalladas, talleres) donde la señal Wi‑Fi o celular es débil o nula. La captura
  de la inspección tiene que poder hacerse ahí y sincronizarse después.
- **Uso móvil en movilidad.** El técnico usa un teléfono Android de gama media, de pie, con una
  mano. El coordinador revisa desde un equipo de escritorio.
- **Datos exclusivamente sintéticos.** En esta etapa no hay backend institucional ni datos
  personales; no hay requisitos de cumplimiento sobre datos reales, pero sí la prohibición de
  introducirlos.
- **Alcance de una materia de 14 semanas** (13 de trabajo efectivo), equipo de 3 personas, sin
  presupuesto, sin cuentas de desarrollador de pago y con competencias centradas en desarrollo web
  (HTML/CSS/JS, React/Next.js), no en desarrollo nativo.
- **Despliegue reproducible.** La evaluación semanal exige que "otra persona pueda clonar, instalar
  y verificar sin conocer tu computadora": el entregable se verifica desde un repositorio y una URL,
  con `npm ci`, `npm run build` y CI en verde.

## Alternativas consideradas

| Criterio | Web tradicional | **PWA (elegida)** | App nativa (Android) | Multiplataforma (Expo/RN) |
| --- | --- | --- | --- | --- |
| Instalación | No instalable | Instalable desde el navegador (A2HS), sin tienda | Play Store / APK | Tienda o build de desarrollo |
| Offline | Ninguno | App Shell + datos en caché + cola de sincronización | Robusto | Bueno con librerías (SQLite) |
| Distribución y verificación | Una URL | Una URL / un repositorio | Cuenta de pago, revisión de tienda | Servicios de build, tiendas |
| Costo de desarrollo | El más bajo (stack conocido) | Moderado (stack conocido + service worker) | Alto (stack no dominado) | Medio-alto (cadena nueva) |
| Mantenimiento | Bajo (1 despliegue) | Bajo-moderado (1 despliegue + versionado de caché) | Alto (ciclos de tienda) | Medio-alto (deps nativas, SDK) |
| Acceso a capacidades del dispositivo | Limitado | Cámara, geolocalización, IndexedDB, notificaciones y Background Sync donde haya soporte | Total | Amplio vía módulos nativos |
| Sirve a móvil + escritorio con una base de código | Sí | Sí | No (solo Android) | Parcial (web secundaria) |
| Riesgo principal | **No cumple el requisito de trabajar sin conexión** | Soporte desigual de algunas APIs (sobre todo iOS/Safari); disciplina de caché | **No cabe en 13 semanas con equipo web; rompe la verificación por URL** | **Sobredimensionado; el entregable semanal se vuelve más frágil** |

Notas por alternativa:

- **Web tradicional:** la más barata y simple, pero descartada porque el requisito central —capturar
  inspecciones en laboratorios sin señal— es precisamente lo que no puede ofrecer.
- **App nativa:** el mejor offline, pero exige cuenta de desarrollador de pago y revisión de tienda,
  deja fuera el escritorio de revisión, y el equipo no domina Kotlin/Java; incompatible con "clonar
  y verificar".
- **Multiplataforma (React Native / Expo / Flutter):** buen offline y un objetivo móvil real, pero
  añade una cadena de herramientas y un artefacto nativo más que mantener en verde cada semana;
  el costo de aprendizaje no se justifica para el alcance.

## Decisión

Se adopta una **PWA construida con Next.js (App Router) y TypeScript**.

Es la única alternativa que a la vez:

1. Satisface el requisito central de **operación con conectividad intermitente** (App Shell y datos
   en caché, cola de sincronización).
2. Se **distribuye y verifica con una sola URL y un repositorio**, que es exactamente la forma de
   entrega y evaluación del curso.
3. **Reutiliza las competencias web del equipo** y cabe en 13 semanas de trabajo incremental.
4. Atiende con **una sola base de código** al técnico en móvil y al coordinador en escritorio.
5. No requiere **cuentas de pago ni revisiones de tienda**.

### Qué no resuelve todavía

- La Semana 1 **no** incluye service worker, manifiesto ni almacenamiento offline: hoy la
  aplicación necesita conexión. La capa PWA se implementa en una semana posterior.
- La sincronización en segundo plano real (Background Sync API) tiene soporte desigual; puede
  requerirse un respaldo con reintento al reabrir la aplicación o al evento `online`.
- En iOS/Safari la instalación y varias APIs son más limitadas; se definirá Chrome para Android y
  navegadores de escritorio como objetivo primario.
- No hay backend real: la "sincronización" se hará contra un almacén simulado o un servicio mínimo
  que se especificará en su momento.

## Consecuencias y riesgos

**Consecuencias positivas:** una sola base de código; despliegue por URL con actualización
inmediata; CI sencilla; iteración semanal de bajo riesgo; costo de distribución nulo.

**Costos asumidos:** complejidad del service worker y de la estrategia de caché; disciplina de
versionado para no servir assets obsoletos; necesidad de probar explícitamente los estados
offline/online.

**Riesgos técnicos y mitigaciones:**

| ID | Riesgo | Mitigación |
| --- | --- | --- |
| R1 | Caché sirve una versión obsoleta de la app o de los datos | "network-first" para datos, "stale-while-revalidate" para el App Shell y versión de caché por despliegue |
| R2 | Background Sync sin soporte en el navegador del usuario | Cola persistente en IndexedDB + reintento al abrir la app y al evento `online` |
| R3 | Límites de iOS/Safari | Declarar navegadores objetivo y degradar con elegancia; documentar el soporte |
| R4 | El usuario limpia el navegador y pierde registros locales no sincronizados | Avisar de forma visible cuántos registros están pendientes y sincronizar en cuanto haya red |
| R5 | La complejidad no cabe en el calendario | Construir por capas; cada semana debe dejar `make verify` en verde antes de avanzar |

## Validación

**Semana 1 (esta entrega).**

- `npm ci` y `npm run build` terminan con código 0.
- `make verify` deja `reports/verification.json` con `"status": "pass"`.
- `npm test` imprime `starter.spec.mjs: PASS` y `bash public-tests/check.sh` imprime `PUBLIC_OK`.
- GitHub Actions ("Starter Semana 1 — feedback") en verde.
- `http://localhost:3000` muestra 3 inspecciones sintéticas.

**Semanas posteriores (cómo se revisará esta decisión).**

- Auditoría de Lighthouse: categoría PWA "installable" sin errores bloqueantes.
- Prueba automatizada que simula pérdida y regreso de red y verifica la transición de estado
  "pendiente" → "sincronizada".
- En DevTools con "Offline" activo, la portada renderiza el listado desde caché en menos de 2 s.
- Medición del JavaScript inicial de la ruta `/` (objetivo < 130 kB comprimido).

**Criterio de reevaluación.** Si al terminar la capa offline el soporte de Background Sync o los
límites de iOS resultan bloqueantes para el Escenario B (captura en sitio), se evaluará una
solución multiplataforma con salida web (Expo) y se registrará como ADR-002.
