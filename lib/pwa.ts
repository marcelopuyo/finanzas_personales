// PWA — constantes y utilidades compartidas entre el cliente y el service
// worker (`public/sw.js`).
//
// ⚠️ `public/sw.js` se sirve tal cual (no pasa por el bundler), así que NO puede
// importar este archivo: los nombres de los mensajes están DUPLICADOS ahí a
// propósito. Si cambiás uno, cambiá el otro.
//
// ℹ️ Desde el versionado (2026-09-15) el SW NO lleva una versión propia: sus
// cachés tienen nombres FIJOS (`fp-assets` / `fp-data` / `fp-meta`) y la
// invalidación la decide el `buildId` del deploy (`lib/version.ts` +
// `/version.json`, ver `sincronizarBuild()` en `public/sw.js`).

/** Ruta del service worker. Va en la raíz para poder controlar todo el sitio. */
export const PWA_SW_URL = "/sw.js";

/** Mensajes cliente ↔ service worker (mismos valores que en `public/sw.js`). */
export const SW_MSG = {
  /** SW → pestañas: el documento servido vino de la caché (no hubo red). */
  servedFromCache: "fp:served-from-cache",
  /** Pestaña → SW: "¿este documento me lo serviste de la caché?". */
  amIFromCache: "fp:am-i-from-cache",
  /** Pestaña → SW: guardá/refrescá el documento de esta ruta (cada ingreso). */
  cacheRoute: "fp:cache-route",
  /** Pestaña → SW: el build que está corriendo la app (invalida caché si cambió). */
  build: "fp:build",
  /** Pestaña → SW: borrar TODO el caché (logout explícito). */
  clearAllCaches: "fp:clear-all-caches",
  /** Pestaña → SW: el usuario aceptó la versión nueva (el SW deja de esperar). */
  skipWaiting: "fp:skip-waiting",
} as const;

/** ¿La app corre INSTALADA (standalone) en vez de en una pestaña del navegador? */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Propiedad legacy de iOS Safari.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** ¿Es iOS/iPadOS? (iPadOS 13+ se identifica como Mac: se detecta por el touch). */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

/**
 * Borra TODO el caché de la app (documentos con datos + estáticos) y pide al
 * service worker que vuelva a precachear la base del modo offline (página de
 * offline + iconos + manifest, que no contienen datos del usuario).
 *
 * Se llama SOLO en el **logout explícito** (decisión del usuario, 2026-09-15):
 * cerrar sesión a mano debe dejar el dispositivo limpio. ⚠️ NO se llama al caer
 * en `/login`, porque ahí se borraría la caché de quien solo dejó vencer la
 * sesión y quiere poder abrir la app sin conexión.
 */
export async function clearAllCaches(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    /* la limpieza nunca debe romper el logout */
  }
  // El SW además vuelve a precachear la base del modo offline.
  navigator.serviceWorker?.controller?.postMessage({
    type: SW_MSG.clearAllCaches,
  });
}
