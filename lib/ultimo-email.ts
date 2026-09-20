// Último email con el que se inició sesión en ESTE dispositivo.
//
// Se guarda en `localStorage` (no en una cookie ni en la base) por dos razones:
// - es un dato **por dispositivo**, igual que la preferencia del bloqueo de la app;
// - la pantalla de login es **pública**: una cookie viajaría en TODAS las
//   requests sin necesidad, y esto solo se lee en el cliente para PREFIJAR el
//   campo Email.
//
// No es un dato sensible: no es una credencial (nunca se guarda la contraseña),
// solo el texto que el usuario ya venía tipeando en cada login.

/** Clave de `localStorage`. */
export const ULTIMO_EMAIL_KEY = "fp_ultimo_email";

/**
 * Último email guardado. Devuelve `""` si no hay nada guardado o si el storage no
 * está disponible (Safari privado, storage bloqueado, SSR).
 */
export function leerUltimoEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(ULTIMO_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * Guarda el email con el que se **acaba de iniciar sesión**. Se llama solo
 * cuando el login fue exitoso, así el valor guardado es siempre un email con el
 * que realmente se entró (y no uno tipeado con un error).
 */
export function guardarUltimoEmail(email: string): void {
  if (typeof window === "undefined") return;
  try {
    const limpio = email.trim();
    if (limpio) window.localStorage.setItem(ULTIMO_EMAIL_KEY, limpio);
  } catch {
    // Sin storage la app funciona igual: simplemente no se prefija el campo.
  }
}
