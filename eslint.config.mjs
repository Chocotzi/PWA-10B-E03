// Semana 8: lint del proyecto (etapa obligatoria del workflow de CI).
// Configuración oficial de Next.js 16 (`next lint` ya no existe en esta versión).
// Se usa ESLint 9 porque los plugins que incluye eslint-config-next (react, import, jsx-a11y)
// todavía no declaran compatibilidad con ESLint 10.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Línea base al adoptar lint en la Semana 8: lo que ya existía y es intencional queda como aviso
    // (visible en CI) y cualquier error nuevo detiene el pipeline. Detalle en docs/test-strategy.md §7.
    rules: {
      // `<a href="/">` es deliberado: navegación completa para que el service worker resuelva la
      // portada y la página sin conexión (Semana 3).
      "@next/next/no-html-link-for-pages": "warn",
      // Reglas pensadas para React Compiler (eslint-plugin-react-hooks 7). El proyecto usa React 18 sin
      // compilador; los casos señalados leen APIs del navegador después de montar para evitar
      // diferencias de hidratación.
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      // `guard` en geolocation.ts se lee dentro de un cierre antes de asignarse.
      "prefer-const": ["error", { ignoreReadBeforeAssign: true }],
    },
  },
  {
    // Los dobles de prueba simulan APIs del navegador parcialmente.
    files: ["tests/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);
