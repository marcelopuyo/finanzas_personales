/**
 * Traspaso del texto dictado entre pantallas (D10 del plan).
 *
 * El botón flotante **no conoce** las cuentas ni las categorías: resuelve la
 * intención, navega, y deja el texto sobrante acá. La pantalla destino lo lee con
 * las opciones ya cargadas en memoria y lo parsea contra sus propios campos.
 *
 * Se usa `sessionStorage` (no estado de módulo) para que sobreviva a una recarga,
 * y la lectura **borra** el texto: es de un solo uso.
 */

const CLAVE = "fp_voz_handoff";

/** Deja el texto para la pantalla destino. Sin texto, limpia lo que hubiera. */
export function dejarTexto(texto: string): void {
  if (typeof window === "undefined") return;
  try {
    const limpio = texto.trim();
    if (limpio) sessionStorage.setItem(CLAVE, limpio);
    else sessionStorage.removeItem(CLAVE);
  } catch {
    // Safari en modo privado puede tirar al escribir: el dictado global queda
    // sin traspaso, pero la navegación ya ocurrió.
  }
}

/** Lee el texto pendiente y lo **borra** (se consume una sola vez). */
export function tomarTexto(): string {
  if (typeof window === "undefined") return "";
  try {
    const valor = sessionStorage.getItem(CLAVE) ?? "";
    if (valor) sessionStorage.removeItem(CLAVE);
    return valor;
  } catch {
    return "";
  }
}

/** Descarta el texto pendiente sin usarlo. */
export function limpiarTexto(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    // idem
  }
}
