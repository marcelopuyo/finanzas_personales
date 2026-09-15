"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { SW_MSG } from "@/lib/pwa";

/**
 * Banner "sin conexión" (PWA).
 *
 * Se muestra cuando la app está mostrando contenido guardado en vez de datos del
 * servidor. Dos señales, porque ninguna alcanza sola:
 * 1. `navigator.onLine` + eventos `online`/`offline` → red caída de plano.
 * 2. Mensaje del service worker → el DOCUMENTO que estás viendo se sirvió de la
 *    caché (red presente pero caída/lenta: `navigator.onLine` diría que sí hay
 *    conexión y el usuario creería que los montos son los actuales).
 *
 * Es un aviso PASIVO: no bloquea acciones (offline las escrituras fallan y el
 * error lo reporta el flujo normal de formularios).
 *
 * Va DENTRO del contenedor que scrollea (`PullToRefresh`) como primer hijo: al
 * ser `sticky` ocupa lugar en el flujo (empuja el contenido) y se queda fijo
 * justo debajo de la top bar, que es `fixed`.
 */

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

const getOnlineSnapshot = () => navigator.onLine;
/** En el servidor se asume "hay conexión" (el banner es 100% cliente). */
const getServerOnlineSnapshot = () => true;

export function OfflineNotice() {
  const online = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getServerOnlineSnapshot
  );
  const [fromCache, setFromCache] = useState(false);

  // ¿Este documento lo sirvió el SW desde la caché?
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; value?: boolean } | undefined;
      if (data?.type === SW_MSG.servedFromCache) setFromCache(data.value === true);
    };
    const onOnline = () => setFromCache(false);

    const sw = navigator.serviceWorker;
    sw?.addEventListener("message", onMessage);
    window.addEventListener("online", onOnline);
    // El SW responde por el mismo canal (no se puede preguntar antes de montar:
    // el mensaje del SW llega mientras la página todavía está cargando).
    sw?.controller?.postMessage({ type: SW_MSG.amIFromCache });

    return () => {
      sw?.removeEventListener("message", onMessage);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  const offline = !online || fromCache;

  // Mientras el aviso está visible, sondear: hay redes (cautivas) donde el
  // evento `online` no llega nunca y el banner quedaría pegado.
  useEffect(() => {
    if (!offline) return;
    const id = window.setInterval(async () => {
      try {
        const response = await fetch("/manifest.webmanifest", {
          method: "HEAD",
          cache: "no-store",
        });
        if (response.ok) setFromCache(false);
      } catch {
        /* sigue sin conexión */
      }
    }, 15000);
    return () => window.clearInterval(id);
  }, [offline]);

  if (!offline) return null;

  return (
    <div className="sticky top-[var(--app-top)] z-30 -mx-4 mb-3 border-b border-warning/30 bg-background px-4 py-2 lg:-mx-6 lg:px-6">
      <p className="flex items-center gap-2 text-[12px] font-medium text-warning">
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
        Sin conexión · mostrando datos guardados
      </p>
    </div>
  );
}
