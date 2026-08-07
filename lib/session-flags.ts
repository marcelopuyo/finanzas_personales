// Claves de sessionStorage para la sesión "no recordar" (por pestaña).
// - NO_REMEMBER: la sesión actual NO marcó "mantener la sesión".
// - PENDING_CLEAR: la pestaña se cerró/recargó y la cookie quedó en gracia de expirar.
// sessionStorage es por pestaña: sobrevive al refresh pero NO a una pestaña nueva.
export const NO_REMEMBER = "fp_no_remember";
export const PENDING_CLEAR = "fp_pending_clear";
