import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // `DeepSeek/` es la carpeta de trabajo del proyecto (plan/bitácora, y está
    // en .gitignore): nunca se compila ni se sirve.
    "DeepSeek/**",
    // Service worker (PWA): se sirve tal cual desde /sw.js, no pasa por el
    // bundler ni por TypeScript; sus globals (self, caches) no son de este lint.
    "public/sw.js",
    // Assets del OCR (plan OCR · F0): los copia `scripts/preparar-ocr.mjs` desde
    // los paquetes de tesseract.js (worker y cores `.wasm.js` minificados) y no
    // se versionan. Lintearlos daba 1000+ problemas sobre código de terceros.
    "public/ocr/**",
    // Código/archivos muertos ya retirados de la app (2026-09-16): no se
    // compilan ni se lintean. Ver `archivo/README.md`.
    "archivo/**",
  ]),
]);

export default eslintConfig;
