/**
 * Detección del **papel** dentro de la captura — plan `DeepSeek/plan-ocr-tickets.md` §11.5.
 *
 * ⚠️ Por qué existe (medido el 2026-10-07 sobre una foto cruda de 3024×4032): el
 * cuadro completo trae **fondo** (mesa, sombras, bordes del papel) que el motor no
 * distingue de un renglón de texto. Ese ruido se **pega a la misma línea** del
 * comercio —el OCR devolvía `DRESS FOR LESS Ze`— y además descoloca los importes.
 * Con la misma foto: el cuadro completo dio `monto 45.73` y `descripcion "GT Re
 * Yaa"`; recortando al papel, `46.73` y `"Dress For Less"`, y **20 % más rápido**
 * (5,6 s contra 7,0 s) por tener menos píxeles que leer.
 *
 * Cómo decide:
 * 1. Umbral de **Otsu** sobre la luminancia ⇒ se adapta a la luz de la escena.
 * 2. La **componente clara más grande** (8 vecinos): el papel es, de lejos, la
 *    mancha clara más grande del cuadro.
 * 3. **Puertas de cordura**: si algo no cierra, se devuelve `rect: null` y el
 *    escáner usa el **cuadro completo**, que es exactamente lo que hacía antes de
 *    que esto existiera. En otras palabras: donde no hay confianza, no se recorta,
 *    así que este paso no puede empeorar una captura por sí solo.
 *
 * Es **puro** (no toca DOM): recibe los píxeles de un lienzo chico, así que se
 * puede medir en Node sin navegador (§11.8 del plan).
 */

/** Recuadro en píxeles de la imagen analizada. */
export type Rectangulo = {
  x: number;
  y: number;
  ancho: number;
  alto: number;
};

/** Resultado del análisis: el recuadro, o el motivo por el que no se recorta. */
export type AnalisisPapel = {
  /** Zona a recortar; `null` ⇒ usar el cuadro completo. */
  rect: Rectangulo | null;
  /** Por qué se descartó (queda para depurar con capturas reales). */
  motivo?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Puertas de cordura (medidas en §11.8: con estos valores, los seis casos de
// prueba —foto real, mesa blanca, mesa sin papel, papel inclinado, papel chico y
// ticket con servilleta al lado— caen del lado correcto)
// ─────────────────────────────────────────────────────────────────────────────

/** Menos que esto en el cuadro es una mancha, no un documento que se pueda leer. */
const AREA_MINIMA = 0.08;

/**
 * Más que esto es el **fondo entero** (papel blanco sobre mesa blanca): ahí el
 * recorte no aporta nada y conviene quedarse con el cuadro completo.
 */
const AREA_MAXIMA = 0.85;

/** Un papel llena su propio recuadro; una mancha irregular, no. */
const LLENADO_MINIMO = 0.5;

/** El papel es lo **claro** de la escena: si no, se detectó otra cosa. */
const LUZ_MINIMA = 140;

/** Alto/ancho mínimo: descarta lo que no tenga forma de documento. */
const PROPORCION_MINIMA = 0.8;

/**
 * Margen que se deja alrededor del recuadro. El borde del papel suele traer el
 * nombre del comercio pegado, y cortar un renglón sale más caro que leer 3 % de
 * fondo de más.
 */
const MARGEN = 0.03;

/** Luminancia (Rec. 601) de un píxel RGBA. */
function luminanciaDe(datos: Uint8ClampedArray, indice: number): number {
  return (datos[indice] * 299 + datos[indice + 1] * 587 + datos[indice + 2] * 114) / 1000;
}

/**
 * Umbral de Otsu: el corte de luminancia que mejor separa las dos poblaciones de
 * la escena (fondo y papel) sin tener que fijar un número a mano.
 */
function umbralOtsu(gris: Uint8Array): number {
  const histograma = new Int32Array(256);
  for (let i = 0; i < gris.length; i++) histograma[gris[i]]++;

  let sumaTotal = 0;
  for (let nivel = 0; nivel < 256; nivel++) sumaTotal += nivel * histograma[nivel];

  let pesoFondo = 0;
  let sumaFondo = 0;
  let mejorVarianza = -1;
  let umbral = 128;

  for (let nivel = 0; nivel < 256; nivel++) {
    pesoFondo += histograma[nivel];
    if (pesoFondo === 0) continue;
    const pesoFrente = gris.length - pesoFondo;
    if (pesoFrente === 0) break;

    sumaFondo += nivel * histograma[nivel];
    const mediaFondo = sumaFondo / pesoFondo;
    const mediaFrente = (sumaTotal - sumaFondo) / pesoFrente;
    const varianza = pesoFondo * pesoFrente * (mediaFondo - mediaFrente) ** 2;

    if (varianza > mejorVarianza) {
      mejorVarianza = varianza;
      umbral = nivel;
    }
  }
  return umbral;
}

type Componente = {
  pixeles: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  luzMedia: number;
};

/**
 * La componente clara más grande, con una pila explícita (nada de recursión: en
 * la captura de un celular esto corre con el dedo del usuario esperando).
 */
function mayorComponenteClara(
  gris: Uint8Array,
  ancho: number,
  alto: number,
  umbral: number
): Componente | null {
  const visto = new Uint8Array(gris.length);
  const pila = new Int32Array(gris.length);
  let mejor: Componente | null = null;

  for (let inicio = 0; inicio < gris.length; inicio++) {
    if (visto[inicio] || gris[inicio] <= umbral) continue;

    let tope = 0;
    pila[tope++] = inicio;
    visto[inicio] = 1;

    let pixeles = 0;
    let sumaLuz = 0;
    let x0 = ancho;
    let y0 = alto;
    let x1 = -1;
    let y1 = -1;

    while (tope > 0) {
      const punto = pila[--tope];
      const x = punto % ancho;
      const y = (punto - x) / ancho;

      pixeles++;
      sumaLuz += gris[punto];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;

      for (let dy = -1; dy <= 1; dy++) {
        const vecinoY = y + dy;
        if (vecinoY < 0 || vecinoY >= alto) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const vecinoX = x + dx;
          if (vecinoX < 0 || vecinoX >= ancho) continue;
          const vecino = vecinoY * ancho + vecinoX;
          if (!visto[vecino] && gris[vecino] > umbral) {
            visto[vecino] = 1;
            pila[tope++] = vecino;
          }
        }
      }
    }

    if (!mejor || pixeles > mejor.pixeles) {
      mejor = { pixeles, x0, y0, x1, y1, luzMedia: sumaLuz / pixeles };
    }
  }

  return mejor;
}

/**
 * Busca el papel en los píxeles RGBA de un lienzo chico.
 *
 * Devuelve el recuadro **en píxeles de esa imagen** (el que llama lo escala a la
 * captura completa) o `null` con el motivo, para usar el cuadro entero.
 */
export function detectarPapel(
  datos: Uint8ClampedArray,
  ancho: number,
  alto: number
): AnalisisPapel {
  const total = ancho * alto;
  const gris = new Uint8Array(total);
  for (let i = 0, p = 0; i < total; i++, p += 4) gris[i] = luminanciaDe(datos, p);

  const umbral = umbralOtsu(gris);
  const componente = mayorComponenteClara(gris, ancho, alto, umbral);
  if (!componente) return { rect: null, motivo: "no hay ninguna zona clara" };

  const area = componente.pixeles / total;
  const anchoCaja = componente.x1 - componente.x0 + 1;
  const altoCaja = componente.y1 - componente.y0 + 1;
  const llenado = componente.pixeles / (anchoCaja * altoCaja);
  const proporcion = altoCaja / anchoCaja;

  const motivo =
    area < AREA_MINIMA
      ? `la zona clara ocupa ${Math.round(area * 100)} % del cuadro`
      : area > AREA_MAXIMA
        ? `la zona clara ocupa ${Math.round(area * 100)} % del cuadro (¿papel sobre fondo claro?)`
        : llenado < LLENADO_MINIMO
          ? `la zona clara no es rectangular (${Math.round(llenado * 100)} %)`
          : componente.luzMedia < LUZ_MINIMA
            ? `la zona clara es oscura (${Math.round(componente.luzMedia)})`
            : proporcion < PROPORCION_MINIMA
              ? `la zona clara es apaisada (${proporcion.toFixed(2)})`
              : null;

  if (motivo) return { rect: null, motivo };

  const margen = Math.round(Math.max(anchoCaja, altoCaja) * MARGEN);
  const x = Math.max(0, componente.x0 - margen);
  const y = Math.max(0, componente.y0 - margen);

  return {
    rect: {
      x,
      y,
      ancho: Math.min(ancho, componente.x1 + 1 + margen) - x,
      alto: Math.min(alto, componente.y1 + 1 + margen) - y,
    },
  };
}
