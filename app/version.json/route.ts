import { APP_BUILD_ID, APP_BUILT_AT, APP_COMMIT, APP_VERSION } from "@/lib/version";

// Estático: se genera en el build (no toca la base ni la sesión) y queda
// excluido del guard de `proxy.ts` junto a los demás archivos de la PWA.
export const dynamic = "force-static";

/**
 * `GET /version.json` — versión desplegada.
 *
 * Sirve para dos cosas:
 * 1. Consultarla desde afuera sin abrir la app (`curl https://…/version.json`).
 * 2. Que el service worker sepa a qué BUILD pertenecen sus cachés: si el build
 *    cambió, descarta los documentos cacheados de la versión anterior.
 */
export function GET() {
  return Response.json({
    version: APP_VERSION,
    commit: APP_COMMIT,
    buildId: APP_BUILD_ID,
    builtAt: APP_BUILT_AT,
  });
}
