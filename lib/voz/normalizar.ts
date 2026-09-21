/**
 * Normalización de texto para el dictado por voz.
 *
 * Regla de oro: **mismo número de tokens antes y después**. Así se puede trabajar
 * con dos arrays alineados por índice — `orig[i]` (con tildes y mayúsculas, para
 * escribir en el formulario) y `norm(orig[i])` (para comparar).
 */

/** Puntuación y símbolos que se recortan de los extremos de cada palabra. */
const PUNT_INI = /^[.,;:!?¡¿"“”'()[\]{}$%+\-–—]+/;
const PUNT_FIN = /[.,;:!?¡¿"“”'()[\]{}$%+\-–—]+$/;

/** Quita las tildes (incluye `ñ` → `n`): solo para comparar, nunca para guardar. */
export function sinTildes(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Normaliza **una** palabra: minúsculas y sin tildes. */
export function norm(token: string): string {
  return sinTildes(token.toLowerCase());
}

/**
 * Parte el texto en palabras y les recorta la puntuación de los extremos
 * (`"gasto,"` → `gasto`, `"$5.000"` → `5.000`). Conserva tildes y mayúsculas.
 */
export function tokenizar(texto: string): string[] {
  return texto
    .split(/\s+/)
    .map((t) => t.replace(PUNT_INI, "").replace(PUNT_FIN, ""))
    .filter(Boolean);
}

/** Texto completo normalizado en una sola pasada (para logs y comparaciones sueltas). */
export function normalizar(texto: string): string {
  return tokenizar(texto).map(norm).join(" ");
}
