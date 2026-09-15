// PWA — constantes y utilidades compartidas entre el cliente y el service
// worker (`public/sw.js`).
//
// ⚠️ `public/sw.js` se sirve tal cual (no pasa por el bundler), así que NO puede
// importar este archivo: la versión y los nombres de caché están DUPLICADOS ahí
// a propósito. Si cambiás algo acá, cambialo también en `public/sw.js`.

/**
 * Versión del service worker y de sus cachés.
 *
 * Subirla (ej. "v2") INVALIDA todo lo cacheado: en `activate` el SW borra las
 * cachés `fp-*` que no sean las actuales, así que los documentos y los chunks
 * del build anterior se descartan. Hacerlo cuando cambie la estrategia.
 */
export const PWA_VERSION = "v1";

/** Prefijo común de todas las cachés de la app. */
export const PWA_CACHE_PREFIX = "fp-";

/** Caché de ESTÁTICOS: chunks hasheados de Next, fuentes e iconos. No tiene
 * datos del usuario, así que se CONSERVA en el logout. */
export const PWA_ASSET_CACHE = `${PWA_CACHE_PREFIX}assets-${PWA_VERSION}`;

/** Prefijo de las cachés de DOCUMENTOS (con montos y nombres del usuario). */
export const PWA_DATA_CACHE_PREFIX = `${PWA_CACHE_PREFIX}data-`;

/** Caché de DOCUMENTOS: el HTML de las pantallas visitadas. Se BORRA en el
 * logout (y al volver a `/login`) para no dejar datos financieros en el
 * dispositivo sin sesión. */
export const PWA_DATA_CACHE = `${PWA_DATA_CACHE_PREFIX}${PWA_VERSION}`;

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
