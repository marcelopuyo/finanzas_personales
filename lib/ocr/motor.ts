/**
 * Envoltorio del motor de OCR (Tesseract.js) — plan `DeepSeek/plan-ocr-tickets.md`.
 *
 * Reglas de la casa que aquí se respetan a propósito:
 *
 * 1. **Import dinámico**: un `import` estático de `tesseract.js` arrastra el
 *    worker de Node al grafo del servidor y rompe el build (naptha/tesseract.js#868);
 *    además metería ~15 MB en el bundle inicial.
 * 2. **Assets self-hosted** en `public/ocr/` (Turbopack no los toca) y **rutas
 *    absolutas**: con `workerBlobURL: false` el worker se crea con URL real, así
 *    que las rutas relativas resolverían mal.
 * 3. **Un solo worker** (singleton): en iOS Safari el WASM es propenso a quedarse
 *    sin memoria si se levantan varios.
 * 4. Sólo las variantes **LSTM** del core están en `public/ocr/` ⇒ el worker se
 *    crea con `oem: 1` y **nunca** con `legacyCore`/`legacyLang` (darían 404).
 */
import { IDIOMAS, RUTA_IDIOMAS, RUTA_OCR } from "./constantes";
import type { Worker } from "tesseract.js";

/** Progreso del motor: `estado` es el texto que reporta Tesseract. */
export type ProgresoOcr = (datos: { estado: string; progreso: number }) => void;

/**
 * Ajustes del motor por lectura.
 *
 * ⚠️ **Medido el 2026-10-07 sobre un ticket real (térmico de Ross)**: `user_defined_dpi`
 * `300` **no cambió ni un carácter** del texto y `psm 4` **perdió líneas** (se comió
 * `Subtotal` y `Total`). El `psm 3` por defecto lee igual de bien el parte **y** el
 * ticket ⇒ no volver a "optimizar" esto sin una muestra que lo demuestre.
 */
export type OpcionesReconocer = {
  /** Si viene, se restringe el charset (útil para leer sólo horas). */
  whitelist?: string;
};

export type ResultadoOcr = {
  texto: string;
  ms: number;
};

let promesaWorker: Promise<Worker> | null = null;
let progresoActual: ProgresoOcr | null = null;

/** El logger se fija al crear el worker; esto permite cambiarlo en cada lectura. */
export function setProgresoOcr(callback: ProgresoOcr | null): void {
  progresoActual = callback;
}

async function crearWorker(): Promise<Worker> {
  // Import dinámico obligatorio (ver nota 1 del encabezado).
  const { createWorker } = await import("tesseract.js");
  const origen = window.location.origin;

  return createWorker(IDIOMAS, 1 /* OEM.LSTM_ONLY */, {
    workerPath: `${origen}${RUTA_OCR}/worker.min.js`,
    corePath: `${origen}${RUTA_OCR}`,
    langPath: `${origen}${RUTA_IDIOMAS}`,
    cacheMethod: "write",
    workerBlobURL: false,
    logger: (m) => {
      progresoActual?.({ estado: String(m.status ?? ""), progreso: Number(m.progress ?? 0) });
    },
  });
}

/** Devuelve el worker único, creándolo la primera vez (baja ~6 MB de assets). */
export function obtenerWorker(): Promise<Worker> {
  if (!promesaWorker) {
    promesaWorker = crearWorker().catch((error) => {
      // Si falló, no dejar la promesa rota cacheada: el próximo intento reintenta.
      promesaWorker = null;
      throw error;
    });
  }
  return promesaWorker;
}

/** Reconoce el texto de una imagen (blob o canvas ya reducido). */
export async function reconocer(
  imagen: Blob | HTMLCanvasElement,
  opciones: OpcionesReconocer = {}
): Promise<ResultadoOcr> {
  const worker = await obtenerWorker();
  if (opciones.whitelist !== undefined) {
    await worker.setParameters({ tessedit_char_whitelist: opciones.whitelist });
  }
  const t0 = performance.now();
  try {
    const { data } = await worker.recognize(imagen);
    return { texto: data.text, ms: Math.round(performance.now() - t0) };
  } finally {
    if (opciones.whitelist !== undefined) {
      // El charset queda pegado al worker: se limpia para no contaminar la próxima lectura.
      await worker.setParameters({ tessedit_char_whitelist: "" });
    }
  }
}

/** Libera el worker y su WASM (obligatorio en iOS antes de salir del flujo). */
export async function liberarWorker(): Promise<void> {
  const promesa = promesaWorker;
  promesaWorker = null;
  if (!promesa) return;
  try {
    const worker = await promesa;
    await worker.terminate();
  } catch {
    /* si nunca llegó a crearse, no hay nada que liberar */
  }
}
