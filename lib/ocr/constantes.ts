/**
 * Constantes del OCR local (plan `DeepSeek/plan-ocr-tickets.md`).
 *
 * Los assets se sirven desde `public/ocr/` y los genera
 * `scripts/preparar-ocr.mjs` en `predev`/`prebuild` (no se commitean).
 */

/** Carpeta de los assets del motor (worker + cores wasm), relativa al origen. */
export const RUTA_OCR = "/ocr";

/** Carpeta de los idiomas (`<lang>.traineddata.gz`), relativa al origen. */
export const RUTA_IDIOMAS = "/ocr/lang";

/** Idiomas del piloto. Con `lstmOnly` Tesseract baja `<lang>.traineddata.gz`. */
export const IDIOMAS = "eng+spa";

/**
 * Lado largo al que se reduce la captura antes del OCR.
 *
 * El celular entrega 4032×3024 (12 MP): pasarlo entero a Tesseract es lento y
 * arriesga OOM en iOS. ~2000 px del lado largo sigue dando de sobra para el
 * texto de un documento que llena el cuadro.
 */
export const LADO_LARGO_OCR = 2000;

/** Caracteres admitidos cuando se lee sólo la zona de horas (evita O/0 y l/1). */
export const WHITELIST_HORAS = "0123456789:.,-/hH";
