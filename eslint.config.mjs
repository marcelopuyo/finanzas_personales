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
    // Service worker (PWA): se sirve tal cual desde /sw.js, no pasa por el
    // bundler ni por TypeScript; sus globals (self, caches) no son de este lint.
    "public/sw.js",
    // Código/archivos muertos ya retirados de la app (2026-09-16): no se
    // compilan ni se lintean. Ver `archivo/README.md`.
    "archivo/**",
  ]),
]);

export default eslintConfig;
