/**
 * Preparar los assets del OCR (plan `DeepSeek/plan-ocr-tickets.md` · fase F0).
 *
 * Copia a `public/ocr/` lo mínimo que necesita Tesseract.js en el navegador,
 * tomándolo de los paquetes instalados:
 *
 *   1. `worker.min.js` (el worker que corre el OCR).
 *   2. **Las 3 variantes LSTM** del core, y sólo esas. Verificado en el código de
 *      `tesseract.js@7`: `createWorker(langs, oem)` con `oem` en LSTM_ONLY deja
 *      `lstmOnly = true` y `getCore.js` elige entre `-lstm`, `-simd-lstm` y
 *      `-relaxedsimd-lstm`; las otras 3 (13,4 MB) son del motor *legacy*
 *      (`oem 0`/`2`), que la app nunca usa. Copiar sólo 3 baja `public/ocr/` de
 *      ~24,6 MB a ~11,2 MB **sin cambiar nada de lo que descarga el celular**
 *      (cada dispositivo usa una sola variante).
 *   3. Los idiomas de `4.0.0_best_int` (los que corresponden a `lstmOnly`).
 *
 * ⛔ **No se commitea** `public/ocr/` (está en `.gitignore`): son ~16 MB de
 * binarios que se regeneran. Este script corre solo en `predev` y `prebuild`, y
 * **falla con exit 1 si falta cualquier origen** (si no, el build pasaría y el
 * OCR se rompería recién en producción).
 */
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nm = path.join(raiz, "node_modules");
const destino = path.join(raiz, "public", "ocr");
const destinoLang = path.join(destino, "lang");

/** Variantes del core para `oem: 1` (LSTM_ONLY), la única que usa la app. */
const CORES = [
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm.js",
  "tesseract-core-relaxedsimd-lstm.wasm.js",
];

/** Idiomas del piloto. Los `.gz` de `4.0.0_best_int` son los de `lstmOnly`. */
const IDIOMAS = ["eng", "spa"];

const TAREAS = [
  {
    desde: path.join(nm, "tesseract.js", "dist", "worker.min.js"),
    hasta: path.join(destino, "worker.min.js"),
  },
  ...CORES.map((archivo) => ({
    desde: path.join(nm, "tesseract.js-core", archivo),
    hasta: path.join(destino, archivo),
  })),
  ...IDIOMAS.map((lang) => ({
    desde: path.join(nm, "@tesseract.js-data", lang, "4.0.0_best_int", `${lang}.traineddata.gz`),
    hasta: path.join(destinoLang, `${lang}.traineddata.gz`),
  })),
];

/** `true` si existe y tiene el mismo tamaño (evita recopiar en cada `dev`). */
async function yaEsta(origen, hasta) {
  try {
    const [a, b] = await Promise.all([stat(origen), stat(hasta)]);
    return a.size === b.size;
  } catch {
    return false;
  }
}

async function main() {
  const faltantes = [];
  for (const t of TAREAS) {
    try {
      await stat(t.desde);
    } catch {
      faltantes.push(t.desde.replace(`${raiz}${path.sep}`, ""));
    }
  }
  if (faltantes.length > 0) {
    console.error("[preparar-ocr] faltan archivos de origen (¿corriste `npm install`?):");
    for (const f of faltantes) console.error(`  - ${f}`);
    process.exit(1);
  }

  await mkdir(destinoLang, { recursive: true });

  let copiados = 0;
  let saltados = 0;
  for (const t of TAREAS) {
    if (await yaEsta(t.desde, t.hasta)) {
      saltados += 1;
      continue;
    }
    await copyFile(t.desde, t.hasta);
    copiados += 1;
  }

  console.log(
    `[preparar-ocr] public/ocr listo · copiados: ${copiados} · ya estaban: ${saltados}`
  );
}

main().catch((error) => {
  console.error("[preparar-ocr] ERROR:", error);
  process.exit(1);
});
