/**
 * Preprocesado de la imagen para el OCR — plan `DeepSeek/plan-ocr-tickets.md` §2.3/D12.
 *
 * Por ahora sólo el **primer** paso del pipeline (el que ya está medido):
 * reducir la captura al lado largo útil. Los siguientes (binarizado, contraste,
 * recorte del papel) se agregan en la fase F4 con evidencia de F7.
 *
 * ⚠️ En el flujo definitivo la reducción va **dentro del mismo `drawImage`** desde
 * el video (nunca se materializa un buffer de 12 MP). Acá se acepta un `Blob` ya
 * capturado porque es lo que produce el disparo del escáner.
 */
import { LADO_LARGO_OCR } from "./constantes";

/** Imagen reducida y lista para pasarle al motor. */
export type ImagenOcr = {
  canvas: HTMLCanvasElement;
  ancho: number;
  alto: number;
  /** Cuánto se redujo respecto del original (1 = no se tocó). */
  escala: number;
};

/**
 * Reduce la imagen al lado largo indicado (~2000 px por defecto).
 *
 * 4032×3024 (12 MP) en Tesseract es lento y arriesga OOM en iOS; ~2000 px del
 * lado largo sigue dando de sobra para el texto de un documento que llena el
 * cuadro.
 */
export async function reducirParaOcr(
  fuente: Blob,
  ladoLargo: number = LADO_LARGO_OCR
): Promise<ImagenOcr> {
  const bitmap = await createImageBitmap(fuente);
  try {
    const escala = Math.min(1, ladoLargo / Math.max(bitmap.width, bitmap.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.max(1, Math.round(bitmap.width * escala));
    lienzo.height = Math.max(1, Math.round(bitmap.height * escala));

    const ctx = lienzo.getContext("2d");
    if (!ctx) throw new Error("No se pudo crear el contexto 2D del canvas");
    ctx.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);

    return { canvas: lienzo, ancho: lienzo.width, alto: lienzo.height, escala };
  } finally {
    bitmap.close();
  }
}
