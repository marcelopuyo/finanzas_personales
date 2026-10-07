/**
 * Preprocesado de la imagen para el OCR — plan `DeepSeek/plan-ocr-tickets.md` §2.3/D12.
 *
 * Dos pasos, y **sólo** dos (cada uno medido con capturas reales, §11.6–§11.8):
 * 1. **Recorte al papel**: quita el fondo, que el motor lee como texto y que se
 *    pegaba a la misma línea del comercio (`DRESS FOR LESS Ze`).
 * 2. **Reducción** al lado largo útil (`LADO_LARGO_OCR`), por memoria y por tiempo.
 *
 * ⚠️ Lo que **no** está acá, a propósito: binarizado y contraste. Se midieron
 * (Sauvola y Otsu) y el texto salió **peor y 3× más lento**, así que esos pasos no
 * se agregan "por mejorar" sin una captura que los justifique (ver `motor.ts`).
 *
 * ⚠️ El recorte y la reducción van **dentro del mismo `drawImage`** (nunca se
 * materializa un buffer de 12 MP): `marcoDesdeVideo` es el camino del escáner;
 * `reducirParaOcr` existe para una imagen ya capturada como `Blob`.
 */
import { LADO_ANALISIS_RECORTE, LADO_LARGO_OCR } from "./constantes";
import { detectarPapel, type Rectangulo } from "./recorte";

/** Imagen reducida y lista para pasarle al motor. */
export type ImagenOcr = {
  canvas: HTMLCanvasElement;
  ancho: number;
  alto: number;
  /** Cuánto se redujo lo leído respecto de la captura (1 = no se tocó). */
  escala: number;
  /** Papel detectado y recortado, o `null` si se usó el cuadro completo. */
  recorte: Rectangulo | null;
};

/** Cómo se dibuja la escena en el lienzo de análisis. */
type Dibujar = (
  ctx: CanvasRenderingContext2D,
  ancho: number,
  alto: number
) => void;

/**
 * Busca el papel dibujando la escena en un lienzo **chico** (`LADO_ANALISIS_RECORTE`).
 *
 * Devuelve el recuadro en píxeles de la captura, o `null` para usar el cuadro
 * completo (comportamiento anterior al recorte).
 */
function recorteDeEscena(
  ancho: number,
  alto: number,
  dibujar: Dibujar
): Rectangulo | null {
  const escala = Math.min(1, LADO_ANALISIS_RECORTE / Math.max(ancho, alto));
  const anchoAnalisis = Math.max(1, Math.round(ancho * escala));
  const altoAnalisis = Math.max(1, Math.round(alto * escala));

  const lienzo = document.createElement("canvas");
  lienzo.width = anchoAnalisis;
  lienzo.height = altoAnalisis;

  // `willReadFrequently` evita que el navegador copie el lienzo a la GPU sólo
  // para poder leerlo con `getImageData`.
  const ctx = lienzo.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  dibujar(ctx, anchoAnalisis, altoAnalisis);
  const { rect } = detectarPapel(
    ctx.getImageData(0, 0, anchoAnalisis, altoAnalisis).data,
    anchoAnalisis,
    altoAnalisis
  );
  if (!rect) return null;

  // De píxeles del análisis a píxeles de la captura, recortando lo que se salga.
  const factorX = ancho / anchoAnalisis;
  const factorY = alto / altoAnalisis;
  const x = Math.min(ancho - 1, Math.max(0, Math.round(rect.x * factorX)));
  const y = Math.min(alto - 1, Math.max(0, Math.round(rect.y * factorY)));

  return {
    x,
    y,
    ancho: Math.max(1, Math.min(ancho - x, Math.round(rect.ancho * factorX))),
    alto: Math.max(1, Math.min(alto - y, Math.round(rect.alto * factorY))),
  };
}

/**
 * Captura un cuadro del video **ya recortado al papel y reducido**.
 *
 * Es el camino del escáner definitivo: se dibuja una sola vez, del video al
 * canvas final, así nunca se materializa un buffer de 12 MP (memoria en iOS).
 */
export function marcoDesdeVideo(
  video: HTMLVideoElement,
  ladoLargo: number = LADO_LARGO_OCR
): ImagenOcr {
  const anchoVideo = video.videoWidth;
  const altoVideo = video.videoHeight;

  const recorte = recorteDeEscena(anchoVideo, altoVideo, (ctx, ancho, alto) =>
    ctx.drawImage(video, 0, 0, ancho, alto)
  );

  const fuente: Rectangulo = recorte ?? {
    x: 0,
    y: 0,
    ancho: anchoVideo,
    alto: altoVideo,
  };
  const escala = Math.min(1, ladoLargo / Math.max(fuente.ancho, fuente.alto));

  const lienzo = document.createElement("canvas");
  lienzo.width = Math.max(1, Math.round(fuente.ancho * escala));
  lienzo.height = Math.max(1, Math.round(fuente.alto * escala));

  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el contexto 2D del canvas");
  ctx.drawImage(
    video,
    fuente.x,
    fuente.y,
    fuente.ancho,
    fuente.alto,
    0,
    0,
    lienzo.width,
    lienzo.height
  );

  return {
    canvas: lienzo,
    ancho: lienzo.width,
    alto: lienzo.height,
    escala,
    recorte,
  };
}

/**
 * Reduce al lado largo indicado una imagen ya capturada como `Blob`, recortando
 * antes al papel igual que `marcoDesdeVideo`.
 *
 * Para el escáner conviene `marcoDesdeVideo` (evita decodificar los 12 MP).
 */
export async function reducirParaOcr(
  fuente: Blob,
  ladoLargo: number = LADO_LARGO_OCR
): Promise<ImagenOcr> {
  const bitmap = await createImageBitmap(fuente);
  try {
    const recorte = recorteDeEscena(
      bitmap.width,
      bitmap.height,
      (ctx, ancho, alto) => ctx.drawImage(bitmap, 0, 0, ancho, alto)
    );

    const zona: Rectangulo = recorte ?? {
      x: 0,
      y: 0,
      ancho: bitmap.width,
      alto: bitmap.height,
    };
    const escala = Math.min(1, ladoLargo / Math.max(zona.ancho, zona.alto));

    const lienzo = document.createElement("canvas");
    lienzo.width = Math.max(1, Math.round(zona.ancho * escala));
    lienzo.height = Math.max(1, Math.round(zona.alto * escala));

    const ctx = lienzo.getContext("2d");
    if (!ctx) throw new Error("No se pudo crear el contexto 2D del canvas");
    ctx.drawImage(
      bitmap,
      zona.x,
      zona.y,
      zona.ancho,
      zona.alto,
      0,
      0,
      lienzo.width,
      lienzo.height
    );

    return {
      canvas: lienzo,
      ancho: lienzo.width,
      alto: lienzo.height,
      escala,
      recorte,
    };
  } finally {
    bitmap.close();
  }
}
