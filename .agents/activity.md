PROPÓSITO
Construir pruebas unitarias, integración y E2E del flujo crítico y automatizarlas en CI.

QUÉ DEBES HACER
1. Trabaja sobre el repositorio del proyecto integrador de la PWA de inspecciones y mantenimiento de laboratorios, usando únicamente datos sintéticos.
2. Implementa el incremento de la semana y documenta decisiones, supuestos, límites y fallos encontrados.
3. Escribe pruebas reproducibles y ejecuta GitHub Actions antes de entregar.

ENTREGABLES OBLIGATORIOS
- tests/unit/
- tests/integration/
- tests/e2e/
- docs/test-strategy.md
- .github/workflows/academic-evaluation.yml
- README.md con setup, ejecución, verificación y evidencia.
- evidence/individual.md con tu commit SHA, decisión técnica, prueba ejecutada, limitación y uso declarado de IA.

ENTREGA
Entrega el enlace o commit SHA del repositorio antes de terminar la semana asignada (máximo 7 días). Ejecuta npm ci y make verify, o documenta el equivalente exacto. No subas secretos, tokens, PII ni respuestas de quizzes.

EVALUACIÓN (8 PUNTOS)
- 2 pts: instalación limpia y build.
- 3 pts: implementación y artefactos obligatorios.
- 2 pts: pruebas automatizadas del comportamiento crítico.
- 1 pt: reporte de ingeniería, trade-offs y evidencia individual.

REGLAS
- Trabajo individual preferente; equipos de hasta 3 solo si el alcance lo justifica y cada integrante debe demostrar dominio.
- IA permitida en esta actividad si declaras herramienta, propósito y validación humana.
- El quiz semanal es presencial, en papel, de 3 preguntas y no permite IA.
- Los checks públicos dan feedback; la calificación final usa commit fijado y checks privados.