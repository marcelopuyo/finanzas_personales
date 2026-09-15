"use client";

import { useEffect } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import Logo from "@/components/layout/logo";

/**
 * Página de "sin conexión" (PWA).
 *
 * El service worker la muestra cuando una navegación falla y no hay documento
 * cacheado de esa ruta; en ese caso redirige a `/offline?from=<ruta pedida>`
 * para poder volver sola a donde el usuario quería ir cuando regrese la
 * conexión.
 *
 * Vive fuera del grupo `(app)` a propósito: no debe pedir sesión ni arrastrar la
 * top bar (cuando no hay red tampoco hay forma de validar la sesión). Por eso
 * también queda excluida del guard de auth en `proxy.ts`.
 */
export default function OfflinePage() {
  useEffect(() => {
    let cancelado = false;

    /** Vuelve a la ruta que el usuario intentó abrir (o recarga esta página). */
    const goBack = () => {
      if (cancelado) return;
      const from = new URLSearchParams(window.location.search).get("from");
      // Solo rutas internas ("/algo"): nunca URLs absolutas (evita open redirect).
      if (from && /^\/(?!\/)/.test(from)) window.location.replace(from);
      else window.location.reload();
    };

    /**
     * Auto-recuperación: en cuanto el SERVIDOR responde, la app continúa sola.
     * Se comprueba con un pedido real y no con `navigator.onLine`: con el server
     * caído pero la red activa, `onLine` sigue en true y volveríamos a caer acá
     * en un bucle.
     */
    const probar = async () => {
      try {
        const response = await fetch("/manifest.webmanifest", {
          method: "HEAD",
          cache: "no-store",
        });
        if (response.ok) goBack();
      } catch {
        /* sigue sin conexión */
      }
    };

    window.addEventListener("online", probar);
    const id = window.setInterval(probar, 6000);

    return () => {
      cancelado = true;
      window.removeEventListener("online", probar);
      window.clearInterval(id);
    };
  }, []);

  /** Reintento manual: mismo criterio que la auto-recuperación. */
  const retry = async () => {
    try {
      const response = await fetch("/manifest.webmanifest", {
        method: "HEAD",
        cache: "no-store",
      });
      if (!response.ok) return;
    } catch {
      return;
    }
    const from = new URLSearchParams(window.location.search).get("from");
    if (from && /^\/(?!\/)/.test(from)) window.location.replace(from);
    else window.location.reload();
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <Logo size={20} />

      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card text-subtitle">
        <WifiOff className="h-6 w-6" />
      </span>

      <div className="max-w-sm">
        <h1 className="text-[18px] font-semibold text-header">Sin conexión</h1>
        <p className="mt-1.5 text-[13px] text-subtitle">
          No pudimos conectarnos con el servidor. Revisá tu conexión: la app se
          recupera sola cuando vuelva.
        </p>
      </div>

      <button
        type="button"
        onClick={retry}
        className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        <RefreshCw className="h-4 w-4" />
        Reintentar
      </button>
    </main>
  );
}
