/**
 * Motivos de transferencia: los **presets "de fábrica"** y el **prefijo** que se
 * antepone a los motivos escritos a mano.
 *
 * Módulo **puro** y **compartido** (cliente + backend): lo consumen la UI del paso
 * del wizard (`app/(app)/movimientos/stepper/transferencia.tsx`), su config de voz
 * (`stepper/dictado-transferencia.ts`), la validación
 * (`backend/src/validation/movimientos.ts`) y la action `transferir`
 * (`backend/src/actions/movimientos.ts`) ⇒ los presets y el prefijo viven en **un
 * solo lugar**.
 *
 * Regla (`plan-motivo-personalizado-transferencia.md`): si el motivo es un
 * **preset** se guarda tal cual; si es **texto libre** se persiste con el prefijo
 * `Transf - ` (p. ej. `peaje` ⇒ `Transf - peaje`).
 */

/** Motivos de transferencia "de fábrica" (cada uno tiene su par propio de
 * conceptos en `buscarConceptosTransferencia` del action `transferir`). */
export const MOTIVOS_TRANSFERENCIA = [
  "Transferencia",
  "Compra Dolares",
  "Venta Dolares",
  "Extraccion",
  "Deposito",
] as const;

/** Prefijo que se antepone a los motivos **personalizados** (nunca a los presets). */
export const PREFIJO_MOTIVO_TRANSFERENCIA = "Transf - ";

/** Tope del motivo **persistido**: mismo `max(60)` de `motivoTransferenciaSchema`
 * (backend) y de la columna `movimiento.motivo`. */
export const MOTIVO_TRANSFERENCIA_MAX = 60;

/** Tope del **texto libre** que escribe el usuario (deja lugar para el prefijo). */
export const MOTIVO_PROPIO_MAX =
  MOTIVO_TRANSFERENCIA_MAX - PREFIJO_MOTIVO_TRANSFERENCIA.length;

/** Prefijo ya escrito por el usuario (tolerante a espacios/guiones y mayúsculas). */
const RE_PREFIJO = /^transf\s*-\s*/i;

/** ¿El motivo es uno de los presets "de fábrica"? */
export function esMotivoPreset(motivo: string): boolean {
  return (MOTIVOS_TRANSFERENCIA as readonly string[]).includes(motivo.trim());
}

/**
 * Etiqueta **final** del motivo (la que se persiste y se muestra):
 * - **preset** ⇒ tal cual, sin prefijo;
 * - **texto libre** ⇒ `Transf - <texto>`.
 *
 * Es **idempotente**: si el texto ya trae el prefijo no lo duplica, y recorta el
 * texto libre a `MOTIVO_PROPIO_MAX` para que el resultado nunca supere la columna
 * (`MOTIVO_TRANSFERENCIA_MAX`).
 */
export function motivoTransferenciaFinal(motivo: string): string {
  const texto = motivo.trim();
  if (!texto || esMotivoPreset(texto)) return texto;
  const sinPrefijo = texto.replace(RE_PREFIJO, "").trim();
  // Si el usuario escribió sólo el prefijo, no hay motivo.
  if (!sinPrefijo) return "";
  return `${PREFIJO_MOTIVO_TRANSFERENCIA}${sinPrefijo.slice(0, MOTIVO_PROPIO_MAX)}`;
}
