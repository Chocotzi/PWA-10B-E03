# Paquete de actividad w06-device-push

Este ZIP contiene el contrato de la actividad, la rúbrica, los checks públicos, la evidencia y el workflow de feedback. Trabaja sobre el mismo repositorio personal que creaste en la Semana 1; no es un proyecto nuevo ni debes descargar otro starter.

Ejecuta bash public-tests/check.sh desde el repositorio de entrega y conserva el commit SHA junto con el reporte de CI.
## Semana 6 — Capacidades del dispositivo

La aplicación usa únicamente datos sintéticos. El cliente de notificaciones locales está en
`src/lib/notifications/client.ts` y solicita permiso solo mediante una acción explícita del usuario.

Verificación:

```bash
npm ci
make verify
npm test
npm run build
```

En Windows sin `make`, el equivalente es `npm run verify`. Las pruebas de notificaciones están en
`tests/notifications.spec.ts` y la evidencia individual en `evidence/individual.md`.
