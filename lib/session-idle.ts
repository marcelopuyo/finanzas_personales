// Ventana de INACTIVIDAD de la sesión, compartida por el proxy (que la aplica y
// renueva) y las rutas de auth (que la respetan).
//
// Módulo PURO a propósito (sin `next/headers`, sin BD, sin `jose`): lo importa
// `proxy.ts`, que corre en el runtime del borde y no debe arrastrar dependencias
// del servidor.
//
// Cómo funciona (2026-09-15, pedido del usuario):
// - El JWT de sesión lleva el claim **`act`** = última actividad (epoch en seg.).
// - Cada request autenticado pasa por el proxy: si la actividad quedó vieja se
//   **reemite el token** con la actividad de ahora y la MISMA expiración absoluta
//   (renovación deslizante con escritura como máximo 1 vez por minuto).
// - Si la actividad superó `IDLE_MAX_SEGUNDOS`, la sesión se considera muerta: se
//   borra la cookie y las rutas protegidas redirigen a /login.
//
// ⚠️ Un activity-check "silencioso" (sin requests) no renueva: una pestaña abierta
// toda la noche vence, que es justo lo que se busca.

/** Inactividad máxima antes de exigir volver a ingresar (1 hora). */
export const IDLE_MAX_SEGUNDOS = 60 * 60;

/**
 * Cada cuánto se reescribe la cookie con la actividad nueva. No se hace en cada
 * request para no estar firmando tokens de más (y evita `Set-Cookie` innecesarios).
 */
export const RENOVAR_CADA_SEGUNDOS = 60;

/** Epoch actual en segundos (la unidad de `act` / `exp` del JWT). */
export function ahoraSegundos(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Antigüedad de la última actividad, en segundos.
 * `null` si el token no trae el dato (tokens emitidos antes de este cambio).
 */
export function segundosSinActividad(
  actividadSegundos: number | null | undefined,
  ahora: number = ahoraSegundos()
): number | null {
  if (!actividadSegundos || !Number.isFinite(actividadSegundos)) return null;
  return Math.max(0, ahora - actividadSegundos);
}
