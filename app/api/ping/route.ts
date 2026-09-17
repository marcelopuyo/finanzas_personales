/**
 * SONDA DEL SERVIDOR (2026-09-17).
 *
 * Responde 204 sin tocar la base de datos ni la sesión. Sirve para distinguir
 * "hay red" de "el servidor responde": `navigator.onLine` sigue devolviendo
 * `true` cuando el server está caído, el WiFi es un portal cautivo o la app
 * quedó detrás de un proxy que contesta 502/503 (ver §95 de la bitácora).
 *
 * Uso: `servidorResponde()` de `lib/net.ts` (candado de la app y, a futuro,
 * otras pantallas que necesiten saber si vale la pena intentar una llamada).
 *
 * ⚠️ Está EXCLUIDA del guard en `proxy.ts` (`api/ping`): la sonda tiene que
 * contestar siempre, incluso sin sesión (justamente se usa cuando la sesión no
 * se puede validar). Y como vive bajo `/api`, el service worker NUNCA la cachea
 * (`/api/**` va siempre a la red, §95).
 */
export const dynamic = "force-dynamic";

const HEADERS = { "cache-control": "no-store" } as const;

export function HEAD() {
  return new Response(null, { status: 204, headers: HEADERS });
}

export function GET() {
  return new Response(null, { status: 204, headers: HEADERS });
}
