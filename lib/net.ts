/**
 * Utilidades de RED del cliente (2026-09-17).
 *
 * `navigator.onLine` NO alcanza para saber si se puede operar: queda en `true`
 * cuando el servidor está caído, cuando el WiFi es un portal cautivo que no
 * autenticó, o cuando un proxy devuelve 502/503/504. Ese fue el caso reportado
 * en el bloqueo de la app: "hay red, pero el server no responde" y el usuario
 * quedaba atrapado en el candado (los dos botones necesitan red).
 */

/** Tiempo máximo que esperamos una respuesta antes de dar el server por caído. */
const TIMEOUT_MS = 4000;

/**
 * ¿El SERVIDOR responde?
 *
 * Pregunta a `/api/ping` (204, sin sesión ni BD, fuera del guard). Cualquier
 * respuesta HTTP cuenta como "vivo" —incluso un 307 o un 500 de nuestra app—:
 * lo único que descarta es que NO haya respuesta (error de red, timeout) o que
 * haya una pasarela rota sin app detrás (502/503/504).
 */
export async function servidorResponde(timeoutMs = TIMEOUT_MS): Promise<boolean> {
  if (typeof window === "undefined") return true;
  // Sin red no hay nada que sondear (`onLine === false` sí es confiable).
  if (navigator.onLine === false) return false;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("/api/ping", {
      method: "HEAD",
      cache: "no-store",
      signal: ctrl.signal,
    });
    // 502/503/504 = hay algo escuchando pero la app NO está detrás.
    return !(res.status >= 502 && res.status <= 504);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
