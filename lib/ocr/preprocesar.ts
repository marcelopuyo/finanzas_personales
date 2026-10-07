/**
 * Preprocesado de la imagen para el OCR — plan `DeepSeek/plan-ocr-tickets.md` §2.3/D12.
 *
 * Por ahora sólo el **primer** paso del pipeline (el que ya está medido):
 * reducir la captura al lado largo útil. Los siguientes (binarizado, contraste,
 * recorte del papel) se agregan cuando F7 diga que hacen falta.
 *
 * ⚠️ La reducción va **dentro del mismo `drawImage`** (nunca se materializa un
 * buffer de 12 MP): `marcoDesdeVideo` es el camino del escáner;
 * `reducirParaOcr` existe para una imagen ya capturada como `Blob`.
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
 * Captura un cuadro del video **ya reducido**.
 *
 * Es el camino del escáner definitivo: se dibuja una sola vez, del video al
 * canvas final, así nunca se materializa un buffer de 12 MP (memoria en iOS).
 */
export function marcoDesdeVideo(
  video: HTMLVideoElement,
  ladoLargo: number = LADO_LARGO_OCR
): ImagenOcr {
  const escala = Math.min(
    1,
    ladoLargo / Math.max(video.videoWidth, video.videoHeight)
  );
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.max(1, Math.round(video.videoWidth * escala));
  lienzo.height = Math.max(1, Math.round(video.videoHeight * escala));

  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el contexto 2D del canvas");
  ctx.drawImage(video, 0, 0, lienzo.width, lienzo.height);

  return { canvas: lienzo, ancho: lienzo.width, alto: lienzo.height, escala };
}

/**
 * Reduce al lado largo indicado una imagen ya capturada como `Blob`.
 *
 * Para el escáner conviene `marcoDesdeVideo` (evita decodificar los 12 MP).
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
