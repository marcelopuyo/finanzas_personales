/** Prefijo obligatorio para motivos de ajustes de cuenta. */
export const PREFIJO_MOTIVO_AJUSTE = "Ajuste - ";

/** Límite de la columna `movimiento.motivo`. */
export const MOTIVO_AJUSTE_MAX = 60;

/** Límite del texto libre, dejando sitio para el prefijo obligatorio. */
export const MOTIVO_AJUSTE_TEXTO_MAX =
  MOTIVO_AJUSTE_MAX - PREFIJO_MOTIVO_AJUSTE.length;

const RE_PREFIJO_AJUSTE = /^ajuste\s*-\s*/i;

/**
 * Devuelve el motivo persistido con el prefijo obligatorio.
 * Es idempotente y limita el texto para respetar el tamaño de la columna.
 */
export function motivoAjusteFinal(motivo: string): string {
  const sinPrefijo = motivo.trim().replace(RE_PREFIJO_AJUSTE, "").trim();
  if (!sinPrefijo) return "Ajuste";
  return `${PREFIJO_MOTIVO_AJUSTE}${sinPrefijo.slice(0, MOTIVO_AJUSTE_TEXTO_MAX)}`;
}
