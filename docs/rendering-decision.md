# Decisión de renderizado

## 1. Contexto

El proyecto debe permitir consultar inspecciones con conectividad normal (escenario A) y preparar
la futura captura durante conectividad intermitente (escenario B). S4 compara una lista interactiva
con un detalle que entregue contenido verificable desde el servidor. La información usada en esta
semana es sintética y vive en `src/lib/data/inspections.ts`.

## 2. Decisión

Decisión del equipo, 27 de septiembre de 2026: `/inspecciones` usa CSR para que el HTML inicial sea
un estado de carga y el navegador consulte `/api/inspecciones`; `/inspecciones/[id]` usa SSR dinámico
para que el detalle llegue en el HTML inicial. La decisión permite comparar interacción y contenido
inicial sin duplicar la fuente de datos.

## 3. Alternativas consideradas

| Alternativa | Decisión |
| --- | --- |
| Todo SSR | Se descartó para el listado porque el filtro y la recuperación de errores serían menos directos en el cliente. |
| Todo CSR | Se descartó para el detalle porque el contenido no estaría en el HTML inicial ni sería tan fácil de compartir. |
| SSG/ISR con `generateStaticParams` | Se descartó porque los datos cambiarán cuando exista sincronización en S5 y no conviene generar una copia estática por identificador. |
| CSR para lista y SSR para detalle | Elegida: separa la interacción frecuente del contenido puntual verificable. |

## 4. Comparación medida

La siguiente tabla se generó desde `reports/rendering-metrics.json` después de `npm run build &&
npm start` y dos ejecuciones de `npm run measure:rendering`. Las cifras son de la corrida guardada
en el JSON; el arreglo `samples` conserva las diez mediciones por ruta.

| Ruta | Estrategia | Build | TTFB mediana (ms) | TTFB p90 (ms) | HTML (bytes) | Dato en HTML inicial |
| --- | --- | --- | ---: | ---: | ---: | --- |
| `/inspecciones` | CSR | `○ Static` | 7.38 | 42.37 | 9011 | No |
| `/inspecciones/inspection-002` | SSR | `ƒ Dynamic` | 13.84 | 16.50 | 10936 | Sí |

En una segunda corrida independiente se obtuvieron, respectivamente, `9.10/34.92 ms` y
`15.16/39.28 ms` para mediana/p90; los tamaños y la presencia del dato se mantuvieron iguales.

La medición complementaria de Lighthouse móvil se ejecuta con tres corridas por ruta:

```text
npx lighthouse http://localhost:3000/inspecciones --preset=perf --form-factor=mobile --screenEmulation.mobile=true --output=json --output-path=reports/lighthouse-inspecciones-1.json
npx lighthouse http://localhost:3000/inspecciones --preset=perf --form-factor=mobile --screenEmulation.mobile=true --output=json --output-path=reports/lighthouse-inspecciones-2.json
npx lighthouse http://localhost:3000/inspecciones --preset=perf --form-factor=mobile --screenEmulation.mobile=true --output=json --output-path=reports/lighthouse-inspecciones-3.json
npx lighthouse http://localhost:3000/inspecciones/inspection-002 --preset=perf --form-factor=mobile --screenEmulation.mobile=true --output=json --output-path=reports/lighthouse-detalle-1.json
npx lighthouse http://localhost:3000/inspecciones/inspection-002 --preset=perf --form-factor=mobile --screenEmulation.mobile=true --output=json --output-path=reports/lighthouse-detalle-2.json
npx lighthouse http://localhost:3000/inspecciones/inspection-002 --preset=perf --form-factor=mobile --screenEmulation.mobile=true --output=json --output-path=reports/lighthouse-detalle-3.json
```

Los valores de Performance y LCP deben anotarse desde esas tres salidas como mediana. La tabla de
accesibilidad de S4.7 se conserva como evidencia manual de las rutas y estados; no se inventan
puntajes cuando no hay una corrida disponible.

## 5. Trade-offs

CSR muestra una carga perceptible y permite filtrar sin pedir de nuevo los datos; su HTML inicial no
contiene las tarjetas. SSR entrega el detalle listo para leer, compartir y revisar, a cambio de
trabajo por petición. El service worker mantiene la portada y el respaldo offline, pero no guarda
las respuestas `/api/` ni debe convertir una respuesta dinámica en una copia obsoleta.

## 6. Hydration mismatch

El desajuste aparece cuando el servidor y el primer render del cliente producen contenido distinto,
por ejemplo por reloj, aleatoriedad, almacenamiento local o estado de red. S4.4 inicia el listado
con `LoadingState` en ambos lados; la consulta ocurre dentro de `useEffect`, y no se usan valores
variables durante el render inicial.

## 7. Estados verificables

| Estado | Cómo reproducirlo | Prueba |
| --- | --- | --- |
| Carga CSR | `/inspecciones?simular=lento` | `tests/rendering.spec.ts`, carga inicial |
| Error CSR | `/inspecciones?simular=error` y luego Reintentar | recuperación después de 500 |
| Error SSR | `/inspecciones/inspection-002?simular=error` | propagación de error simulado |
| No encontrado | `/inspecciones/inspection-999` | llamada a `notFound` |
| Filtro | Seleccionar “Requiere atención” | tres tarjetas con atención |

## 8. Límites de datos

Hay entre 3 y 20 registros, entre 0 y 10 hallazgos por registro, textos de hasta 280 caracteres,
fechas `AAAA-MM-DD`, identificadores `inspection-NNN` y responsables anónimos. Todos los datos son
sintéticos y se cargan desde `src/lib/data/inspections.ts`.

## 9. Home, splash y carga

La home es `/` y enlaza a `/inspecciones`. El splash lo genera el navegador a partir del manifiesto
de S2, usando `background_color`, `theme_color` e íconos. La carga visible usa
`src/components/loading-state.tsx`, compartido por CSR y SSR.

## 10. Fallos encontrados y riesgos

Durante la implementación, una promesa de prueba que no terminaba dejaba abierta la suite; se
diagnosticó añadiendo limpieza explícita de los árboles montados y abortando la petición simulada.
También hubo que usar una referencia estable para los parámetros de búsqueda, porque una referencia
nueva en cada render repetía el efecto. En producción, la ruta dinámica depende de que el origen de
datos responda y Safari puede presentar diferencias en caché y carga.

## 11. Supuestos, límites y trabajo futuro

Se supone que las inspecciones sintéticas representan el flujo de consulta. La captura, persistencia
local y sincronización quedan para S5; esta decisión no mide esas operaciones. Trabajo futuro:
conectar el repositorio a una fuente persistente, repetir la medición con datos reales de prueba
controlados y completar la tabla de Lighthouse con las tres corridas por ruta.

## 12. Trazabilidad

| Requisito | Archivo | Prueba | Evidencia |
| --- | --- | --- | --- |
| RF-02, RF-04 | `src/app/inspecciones/[id]/page.tsx`, `src/lib/inspections-repository.ts` | SSR, límites y error en `tests/rendering.spec.ts` | `reports/rendering-metrics.json` |
| RF-08 | `src/components/inspections-list-client.tsx` | filtro local en `tests/rendering.spec.ts` | corrida de pruebas |
| RNF-03 | `src/components/loading-state.tsx`, `src/components/error-state.tsx`, `src/app/globals.css` | estados accesibles | tabla de S4.7 |
| RNF-04 | `src/app/inspecciones/page.tsx`, `src/app/inspecciones/[id]/page.tsx` | `npm run build` | métricas y salida del build |
| RNF-05 | `public/sw.js`, `docs/cache-strategy.md` | `tests/service-worker.spec.ts` | caché y respaldo offline |
| AC-04 | esta decisión y rutas CSR/SSR | `tests/rendering.spec.ts` | JSON, build y Lighthouse |
