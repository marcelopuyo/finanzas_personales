/*
 * Service worker de Finanzas Personales (PWA).
 *
 * ⚠️ Este archivo se sirve TAL CUAL desde `/sw.js` (vive en `public/`): no pasa
 * por el bundler, no lo ve TypeScript y no lo lintea ESLint (ver
 * `eslint.config.mjs`). Por eso la versión y los nombres de caché están
 * DUPLICADOS respecto de `lib/pwa.ts` — si cambiás uno, cambiá el otro.
 *
 * Estrategia (decisiones 2026-09-14):
 * - ESTÁTICOS (`/_next/static/**`, `/icons/**`) → cache-first. Los chunks llevan
 *   hash, así que nunca se sirven viejos.
 * - NAVEGACIONES (documentos) → network-first SIN timeout: si la red responde,
 *   siempre se ven datos frescos; la caché entra solo cuando la red falla.
 * - `/api/**` y POST (Server Actions) → red siempre, nunca caché.
 * - La caché de documentos (`fp-data-*`) se BORRA en el logout y al caer en
 *   `/login`: es HTML con montos y nombres del usuario.
 * - Actualización: el SW nuevo queda en `waiting` hasta que el usuario acepta
 *   (la app muestra un toast con "Recargar"); al reabrir la app entra solo.
 */

const VERSION = "v1";

const CACHE_PREFIX = "fp-";
const ASSET_CACHE = `${CACHE_PREFIX}assets-${VERSION}`;
const DATA_CACHE = `${CACHE_PREFIX}data-${VERSION}`;
const META_CACHE = `${CACHE_PREFIX}meta-${VERSION}`;
const DATA_PREFIX = `${CACHE_PREFIX}data-`;
const META_PREFIX = `${CACHE_PREFIX}meta-`;

/** Estáticos que se precachean al instalar (no tienen datos del usuario). */
const PRECACHE = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icon.png",
  "/apple-icon.png",
];

/**
 * Documentos de arranque: se precachean al instalar (con la sesión activa) para
 * que la app tenga una pantalla de entrada incluso sin haberla visitado antes.
 * Si el servidor responde con un redirect (sesión vencida → /login) se descarta.
 */
const PRECACHE_DOCS = ["/dashboard"];

/** Tope de documentos cacheados (los más viejos se van descartando). */
const DOCS_LIMIT = 30;
/** Vencimiento de un documento cacheado: 15 días. */
const DOCS_TTL = 15 * 24 * 60 * 60 * 1000;
/** Ruta de la página que se muestra cuando no hay red ni documento cacheado. */
const OFFLINE_URL = "/offline";

// Mensajes (mismos valores que `SW_MSG` en `lib/pwa.ts`).
const MSG_SERVED_FROM_CACHE = "fp:served-from-cache";
const MSG_AM_I_FROM_CACHE = "fp:am-i-from-cache";
const MSG_CLEAR_DATA_CACHES = "fp:clear-data-caches";
const MSG_SKIP_WAITING = "fp:skip-waiting";

/**
 * clientIds a los que se les sirvió el DOCUMENTO desde la caché. La app lo
 * consulta al montar para mostrar el banner "sin conexión" (el aviso por
 * `navigator.onLine` no alcanza: hay redes lentas que sí fallan al navegar).
 */
const servedFromCache = new Set();

// ─────────────────────────────────────────────────────────────────────────────
// Ciclo de vida
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(precache());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Borrar las cachés de versiones anteriores (solo las de esta app).
      const keep = [ASSET_CACHE, DATA_CACHE, META_CACHE];
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && !keep.includes(key))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

async function precache() {
  // 1) Estáticos: una falla puntual no debe abortar la instalación.
  const assets = await caches.open(ASSET_CACHE);
  await Promise.all(
    PRECACHE.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "reload" });
        if (!response.ok || response.redirected) return;
        const stored = response.clone();
        // La página de offline se sirve SIN red: hay que cachear también los
        // chunks/CSS/fuentes que referencia en su HTML. Si no, el HTML se ve
        // pero falla la hidratación (y con ella el botón Reintentar y la
        // auto-recuperación).
        const html = url === OFFLINE_URL ? await response.clone().text() : null;
        await assets.put(url, stored);
        if (html) await cacheDocumentAssets(html, assets);
      } catch {
        /* se reintenta en el próximo fetch */
      }
    })
  );

  // 2) Documentos de arranque (solo si no hubo redirect a /login).
  await Promise.all(
    PRECACHE_DOCS.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "reload" });
        if (response.ok && response.type === "basic" && !response.redirected) {
          await storeDocument(url, response.clone());
        }
      } catch {
        /* sin sesión o sin red: no se precachea nada */
      }
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch
// ─────────────────────────────────────────────────────────────────────────────

/** Assets estáticos referenciados por un documento (`_next/static/...`). */
const ASSET_URL_RE = /\/_next\/static\/[^"'<>\s)\\]+/g;

/**
 * Cachea los assets que referencia un documento (chunks, CSS, fuentes).
 * Se usa con la página de offline, que tiene que funcionar con el servidor
 * caído: su HTML solo no alcanza, necesita sus chunks para hidratar.
 */
async function cacheDocumentAssets(html, cache) {
  const urls = new Set(html.match(ASSET_URL_RE) || []);
  await Promise.all(
    [...urls].map(async (url) => {
      try {
        if (await cache.match(url)) return;
        const response = await fetch(url, { cache: "reload" });
        if (response.ok && response.type === "basic") {
          await cache.put(url, response.clone());
        }
      } catch {
        /* un asset que falle no invalida el resto */
      }
    })
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // POST/PUT/DELETE (Server Actions) y todo lo que no sea GET: siempre a la red.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // terceros → red
  if (url.pathname.startsWith("/api/")) return; // datos frescos siempre
  if (url.pathname === "/sw.js") return; // el propio SW no se cachea

  // Estáticos con hash / iconos → cache-first.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(cacheFirst(event, request));
    return;
  }

  // Navegaciones (documentos) → network-first con fallback a caché y a /offline.
  if (request.mode === "navigate") {
    event.respondWith(documentFromNetwork(event, request));
  }

  // Los payloads RSC de las navegaciones de cliente (`?_rsc=`) NO se cachean a
  // propósito: si se guardara un prefetch parcial, la navegación podría romperse.
  // Sin caché de RSC, offline Next cae a una navegación completa (MPA) y esa sí
  // la resuelve este SW desde la caché de documentos.
});

/** Cache-first para estáticos: si está cacheado se sirve al instante. */
async function cacheFirst(event, request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
  }
  return response;
}

/**
 * Network-first SIN timeout para documentos: la red manda; la caché solo entra
 * cuando el fetch falla (sin conexión o red caída).
 */
async function documentFromNetwork(event, request) {
  const clientId = event.resultingClientId || event.clientId;

  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic" && !response.redirected) {
      event.waitUntil(storeDocument(request, response.clone()));
      servedFromCache.delete(clientId);
    }
    return response;
  } catch {
    const cached = await readDocument(request);
    if (cached) {
      servedFromCache.add(clientId);
      notifyFromCache(clientId);
      return cached;
    }

    // Sin documento cacheado:
    // - Si lo pedido ES la página de offline, se sirve de la caché de estáticos
    //   (donde está precacheada). Sin este caso entraríamos en un BUCLE INFINITO
    //   de redirects: /offline también es una navegación que falla sin red.
    // - Si no, se redirige a /offline llevando la ruta pedida en `?from=` para
    //   poder volver sola a donde el usuario quería ir cuando regrese la red.
    const url = new URL(request.url);
    if (url.pathname === OFFLINE_URL) {
      const offlinePage = await caches.match(OFFLINE_URL, {
        cacheName: ASSET_CACHE,
      });
      if (offlinePage) return offlinePage;
      // Precarga incompleta: mejor un error explícito que un bucle.
      return new Response("Sin conexión", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    const target = `${url.pathname}${url.search}`;
    return Response.redirect(
      `${OFFLINE_URL}?from=${encodeURIComponent(target)}`,
      302
    );
  }
}

/** Avisa a UNA pestaña que su documento vino de la caché. */
async function notifyFromCache(clientId) {
  if (!clientId) return;
  try {
    const client = await self.clients.get(clientId);
    client?.postMessage({ type: MSG_SERVED_FROM_CACHE, value: true });
  } catch {
    /* la pestaña ya no existe */
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Caché de documentos (con marca de tiempo en una caché aparte, para no tener
// que reconstruir las respuestas — rearmar un Response puede romper los headers
// de `content-encoding`/`content-length`).
// ─────────────────────────────────────────────────────────────────────────────

async function storeDocument(request, response) {
  const cache = await caches.open(DATA_CACHE);
  const meta = await caches.open(META_CACHE);
  await cache.put(request, response);
  await meta.put(request.url, new Response(String(Date.now())));
  await trimDocuments();
}

async function readDocument(request) {
  const cache = await caches.open(DATA_CACHE);
  const response = await cache.match(request);
  if (!response) return undefined;

  const meta = await caches.open(META_CACHE);
  const stamp = await meta.match(request.url);
  const at = stamp ? Number(await stamp.text()) : 0;

  // Sin marca de tiempo (o vencido) se descarta: mejor /offline que datos viejos.
  if (!Number.isFinite(at) || at === 0 || Date.now() - at > DOCS_TTL) {
    await cache.delete(request);
    await meta.delete(request.url);
    return undefined;
  }

  return response;
}

/** Descarta documentos vencidos y, si sobran, los más viejos hasta DOCS_LIMIT. */
async function trimDocuments() {
  const cache = await caches.open(DATA_CACHE);
  const meta = await caches.open(META_CACHE);
  const keys = await cache.keys();

  const entries = [];
  for (const key of keys) {
    const stamp = await meta.match(key.url);
    const at = stamp ? Number(await stamp.text()) : 0;
    entries.push({ key, at: Number.isFinite(at) ? at : 0 });
  }

  const expired = entries.filter(
    (entry) => entry.at === 0 || Date.now() - entry.at > DOCS_TTL
  );
  for (const entry of expired) {
    await cache.delete(entry.key);
    await meta.delete(entry.key.url);
  }

  const alive = entries
    .filter((entry) => !expired.includes(entry))
    .sort((a, b) => a.at - b.at);

  for (const entry of alive.slice(0, Math.max(0, alive.length - DOCS_LIMIT))) {
    await cache.delete(entry.key);
    await meta.delete(entry.key.url);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mensajes desde la app
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener("message", (event) => {
  const data = event.data || {};

  // El usuario aceptó la versión nueva: dejar de esperar → se activa ya.
  if (data.type === MSG_SKIP_WAITING) {
    self.skipWaiting();
    return;
  }

  // Logout / sesión vencida: fuera todo el HTML con datos del usuario.
  if (data.type === MSG_CLEAR_DATA_CACHES) {
    event.waitUntil(clearData());
    return;
  }

  // ¿Este documento vino de la caché? (lo pregunta el banner al montar).
  if (data.type === MSG_AM_I_FROM_CACHE) {
    const client = event.source;
    client?.postMessage({
      type: MSG_SERVED_FROM_CACHE,
      value: servedFromCache.has(client.id),
    });
  }
});

async function clearData() {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter(
        (key) => key.startsWith(DATA_PREFIX) || key.startsWith(META_PREFIX)
      )
      .map((key) => caches.delete(key))
  );
  servedFromCache.clear();
}
