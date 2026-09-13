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

