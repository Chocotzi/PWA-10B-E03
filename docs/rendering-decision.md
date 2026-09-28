# Decisión de renderizado

## Objetivo

Comparar una ruta de listado renderizada en servidor con una futura interacción renderizada en el
cliente, usando únicamente datos sintéticos.

## Ruta SSR

`/inspecciones` inicia como Server Component para entregar el encabezado del listado desde el
servidor y mantener una respuesta simple y reproducible.

## Ruta de detalle

`/inspecciones/[id]` recibe el identificador mediante `params` como `Promise`, de acuerdo con el
contrato de Next.js 16.

## Ruta CSR e interacción

La interacción cliente se incorporará sobre el mismo dominio sin convertir innecesariamente el
layout raíz en un componente cliente.

## Estados verificables

Las rutas deben contemplar estados de carga, error y contenido. `LoadingState` es el componente
provisional que se reutilizará cuando se complete la interacción cliente.

## Límites y evidencia

Los datos son sintéticos y la comparación se verificará con las pruebas de `tests/rendering.spec.ts`,
el build de Next.js y la revisión de las rutas generadas.
