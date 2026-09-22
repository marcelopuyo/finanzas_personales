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
    // en .gitignore): nunca se compila ni se sirve. Ahí caen además los
    // artefactos crudos del build de sherpa-onnx (`tmp-sherpa/`), que son JS
    // generado por Emscripten y dan ~100 avisos que no son nuestros (2026-09-22).
    "DeepSeek/**",
    // Service worker (PWA): se sirve tal cual desde /sw.js, no pasa por el
    // bundler ni por TypeScript; sus globals (self, caches) no son de este lint.
    "public/sw.js",
    // Laboratorio de voz offline (temporal): el motor es sherpa-onnx compilado a
    // WASM (terceros, servido tal cual) y `piloto.js` corre en el scope global de
    // scripts clásicos contra `Module`/`CircularBuffer` del runtime, así que
    // tampoco pasa por el bundler ni por TypeScript (§plan-voz-offline-sherpa).
    "public/voz-lab/**",
    // Código/archivos muertos ya retirados de la app (2026-09-16): no se
    // compilan ni se lintean. Ver `archivo/README.md`.
    "archivo/**",
  ]),
]);

export default eslintConfig;
