# Capacidades del dispositivo

Este documento describe la integración de las capacidades del hardware del dispositivo en la PWA de inspecciones.

## Cámara (Captura de evidencia)

La aplicación permite la captura opcional de imágenes como evidencia durante una inspección, utilizando la API de `navigator.mediaDevices.getUserMedia`.

**Permisos y Privacidad:**
- El permiso de acceso a la cámara se solicita únicamente cuando el usuario hace clic en el botón para tomar la foto, asegurando que se solicite bajo una acción explícita.
- La cámara se apaga inmediatamente después de capturar la imagen, liberando el flujo de video y respetando la privacidad del usuario.

**Manejo de Fallos (Fallback) y Datos Sintéticos:**
- En entornos donde la API no está disponible (por ejemplo, contextos no seguros HTTP, navegadores no compatibles) o el usuario deniega el permiso, la aplicación emplea un mecanismo de fallback robusto.
- Se ha implementado el uso de "datos sintéticos" (una imagen de un píxel codificada en base64) para simular la captura, garantizando que el flujo de trabajo no se vea interrumpido en ningún momento.

## Geolocalización

Se implementa el uso de la API `navigator.geolocation` para registrar de manera automática la ubicación de la inspección.

**Permisos y Privacidad:**
- Al igual que la cámara, el permiso solo se requiere en el momento de crear el reporte.
- Se configuró con parámetros de tiempo límite (`timeout`) y tiempo de validez (`maximumAge`) adecuados para evitar esperas infinitas que detengan el guardado.

**Manejo de Fallos (Fallback) y Datos Sintéticos:**
- Si el usuario declina compartir su ubicación o el navegador carece de la API, el sistema provee coordenadas sintéticas correspondientes a la Universidad Tecnológica de Tehuacán (`latitude: 18.4627, longitude: -97.3928`). Esto permite que el componente geográfico siga funcional y la métrica de inspección se procese sin error.

## Notificaciones

[Nota: Esta sección será completada por mi compañero(a) de equipo.]
