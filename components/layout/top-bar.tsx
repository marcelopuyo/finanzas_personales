"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mic } from "lucide-react";
import Logo from "./logo";
import { cn } from "@/lib/utils";
import { EVENTO_VOZ_DICTAR, EVENTO_VOZ_ESTADO } from "@/lib/voz/config";

/**
 * Top bar ÚNICA de la app (mobile y desktop): logo "finanzas personales" a la
 * IZQUIERDA (acceso al Resumen /dashboard) y avatar del usuario a la DERECHA
 * (acceso a Perfil /perfil, sin texto). No hay sidebar lateral: desde
 * 2026-09-09 toda la navegación vive en el dashboard (los CRUDs se abren desde
 * el dashboard con su flecha "volver"; Perfil/Admin viven detrás del avatar).
 */
export default function TopBar({
  initial = "U",
  userLabel = "Perfil",
}: {
  /** Inicial (primera letra del nombre/email) para el avatar. */
  initial?: string;
  /** Etiqueta del usuario (tooltip/aria del avatar). */
  userLabel?: string;
}) {
  // El dictado lo maneja `VozFab` (montado en `AppLayout`); acá solo se refleja
  // **si está escuchando** para conservar el feedback que daba el FAB (rojo + pulso).
  const [escuchando, setEscuchando] = useState(false);
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ escuchando?: boolean }>).detail;
      setEscuchando(Boolean(d?.escuchando));
    };
    window.addEventListener(EVENTO_VOZ_ESTADO, h);
    return () => window.removeEventListener(EVENTO_VOZ_ESTADO, h);
  }, []);

  return (
    <header
      className="fixed top-0 right-0 left-0 z-50 border-b border-border bg-sidebar"
      // PWA standalone: con `viewport-fit: cover` el contenido pasa por debajo de
      // la barra de estado / notch, así que el header crece con el safe-area y
      // conserva sus 3.5rem (h-14) de contenido. El scroll compensa con el mismo
      // valor en `app-layout.tsx`.
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <Link
          href="/dashboard"
          aria-label="Ir al resumen"
          title="Resumen"
          className="rounded-lg transition-opacity hover:opacity-90"
        >
          <Logo size={20} />
        </Link>

        <div className="flex items-center gap-1">
          {/* 🎤 DICTADO (2026-10-01, rama `rediseno-ui`): dejó de ser un FAB en la
              esquina inferior derecha para vivir acá, así la esquina del pulgar
              queda para el "+" (crear). El botón NO tiene lógica de voz: dispara
              `EVENTO_VOZ_DICTAR` y `VozFab` (montado en `AppLayout`) hace el resto
              ⇒ el motor de voz queda intacto. */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(EVENTO_VOZ_DICTAR))}
            aria-label={escuchando ? "Detener el dictado" : "Dictar"}
            title={escuchando ? "Escuchando…" : "Dictar"}
            className={cn(
              "relative rounded-full p-1.5 transition-colors",
              escuchando
                ? "text-danger"
                : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
            )}
          >
            {escuchando && (
              <span
                className="fp-voz-pulso absolute inset-0 rounded-full bg-danger"
                aria-hidden="true"
              />
            )}
            <Mic className="relative h-5 w-5" />
          </button>

          <Link
            href="/perfil"
            aria-label={userLabel}
            title={userLabel}
            className="ml-1 rounded-full transition-opacity hover:opacity-90"
          >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#414346] text-[15px] font-semibold text-[#f0f1f2]"
            style={{ width: 32, height: 32 }}
          >
            {initial}
          </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
