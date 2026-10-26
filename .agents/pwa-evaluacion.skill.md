---
name: pwa-evaluacion
description: Implementa, integra y revisa una PWA de código para cumplir una evaluación técnica basada en instalación/build, entregables, pruebas automatizadas y evidencia de ingeniería.
---

# PWA para evaluación técnica

Usa esta habilidad cuando debas crear, completar o auditar una PWA que será calificada con una rúbrica técnica. Conserva los requisitos explícitos de la asignación por encima de cualquier convención de este documento. No declares un criterio como aprobado sin evidencia verificable en el repositorio o en la salida de los comandos.

## Objetivo de entrega

Entrega una PWA instalable y construible desde cero, con los artefactos solicitados, una implementación coherente del comportamiento crítico, pruebas automatizadas que lo cubran y un reporte de ingeniería breve. Trabaja primero sobre el requisito funcional y luego refuerza integración, calidad y evidencia.

## Interpretar la asignación

- Extrae los requisitos como una lista comprobable: comportamiento, pantallas, datos, persistencia, PWA/offline, integraciones, artefactos y formato de entrega.
- Distingue entre lo obligatorio, lo opcional y lo que falta precisar. No inventes funcionalidades para compensar una consigna ambigua.
- Define el comportamiento crítico: la ruta de usuario o regla de negocio cuyo fallo haría que el producto no cumpla su finalidad. Úsalo para priorizar implementación y pruebas.
- Mantén una matriz requisito → archivo/artefacto → prueba/evidencia. Actualízala mientras trabajas.

## Implementación e integración

- Respeta la arquitectura y herramientas ya presentes. Agrega dependencias solo cuando reduzcan complejidad o sean necesarias para cumplir la consigna.
- Separa componentes de interfaz, lógica de dominio, acceso a datos y adaptadores externos. La lógica crítica debe poder probarse sin navegador, red ni almacenamiento real cuando sea posible.
- Trata estados de carga, error, vacío y éxito de los flujos visibles. Valida entradas y evita que fallas de red o datos inválidos dejen la interfaz bloqueada.
- Para PWA, verifica al menos `manifest`, iconos/rutas válidas, registro del service worker y la estrategia de caché acorde al producto. No prometas funcionamiento offline si no está probado.
- Conserva compatibilidad con la configuración de build existente. No expongas secretos en código cliente, archivos de ejemplo ni reportes.
- Antes de integrar cambios, revisa nombres, límites de responsabilidad, manejo de errores, accesibilidad básica (etiquetas, foco, contraste razonable) y ausencia de código muerto o duplicado relevante.

## Rúbrica de 8 puntos

### 1. Instalación limpia y build — 2 puntos

Verifica en un entorno limpio o equivalente:

1. Instalar dependencias usando el gestor y archivo de bloqueo del repositorio.
2. Ejecutar el build de producción.
3. Ejecutar el comando de arranque o previsualización si existe.
4. Corregir advertencias que revelen rutas faltantes, variables obligatorias sin documentar o fallos de registro PWA.

Documenta los comandos exactos, versiones relevantes y resultado. Si la validación no puede ser limpia de verdad, indícalo como limitación y describe qué se aisló.

### 2. Implementación y artefactos obligatorios — 3 puntos

Para cada requisito, aporta evidencia directa: archivo, componente, configuración, captura o salida de prueba. Comprueba especialmente:

- La funcionalidad principal completa el flujo esperado y conserva el estado necesario.
- Los artefactos pedidos existen con nombres, rutas y formatos correctos.
- El manifest, service worker y recursos PWA no contienen rutas rotas.
- La interfaz permite realizar la tarea sin depender de datos o acciones manuales ocultas.

No sustituyas un artefacto solicitado por una descripción en el reporte. Si una parte no se logró, señálala claramente y explica el impacto.

### 3. Pruebas automatizadas del comportamiento crítico — 2 puntos

- Escribe pruebas deterministas del flujo o regla crítica, incluyendo el caso exitoso y al menos un límite o error relevante.
- Prefiere pruebas de unidad para reglas y pruebas de integración/interfaz para la experiencia de usuario. Simula red, tiempo y almacenamiento cuando esa dependencia no sea el objeto de la prueba.
- Verifica resultados observables: datos persistidos, estado mostrado, navegación, llamadas a adaptadores o mensajes de error. No bases las pruebas solo en detalles internos de implementación.
- Ejecuta la suite completa y registra el comando, número de pruebas y resultado. Si no existe infraestructura, añade la mínima necesaria y documenta el motivo.

### 4. Reporte de ingeniería, trade-offs y evidencia individual — 1 punto

Incluye un archivo como `docs/reporte-ingenieria.md` o el formato solicitado con:

1. Alcance implementado y cómo ejecutar el proyecto.
2. Arquitectura breve y decisiones técnicas relevantes.
3. Trade-offs: alternativas consideradas, elección y coste aceptado.
4. Evidencia: comandos de instalación, build y tests; rutas de artefactos; capturas o resultados si aplican.
5. Trabajo individual: cambios, decisiones o módulos atribuibles a cada integrante, si la evaluación lo solicita.
6. Limitaciones conocidas y pasos concretos para resolverlas.

El reporte debe reflejar el estado real del repositorio, no una lista de intenciones.

## Revisión final

Antes de entregar, recorre esta lista:

- [ ] La instalación usa un lockfile coherente y no depende de archivos locales no versionados.
- [ ] El build de producción termina correctamente.
- [ ] La PWA tiene manifest, service worker y recursos referenciados válidos.
- [ ] Cada artefacto obligatorio está presente y enlazado desde donde corresponda.
- [ ] El flujo crítico funciona y cuenta con pruebas automatizadas ejecutadas.
- [ ] Los errores previsibles tienen una respuesta comprensible para la persona usuaria.
- [ ] No hay secretos, datos personales innecesarios ni dependencias sin justificación.
- [ ] El reporte contiene comandos, resultados, trade-offs y evidencia individual.

## Forma de comunicar el resultado

Resume el estado por criterio de la rúbrica con «aprobado», «parcial» o «pendiente», enlaza la evidencia concreta y no asignes puntos finales salvo que la persona evaluadora haya definido cómo interpretar la calidad. Para estados parciales, explica con precisión qué impide el cumplimiento y el siguiente cambio mínimo.