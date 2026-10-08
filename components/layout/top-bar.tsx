"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  /**
   * **Inicio**: la banda arranca a sangre ⇒ la barra va **transparente** en el top
   * para que la banda se vea continua (sin borde ni cambio de tono). Apenas el
   * contenido sale del tope, la propia página marca `html.fp-inicio-scrolled` y
   * `.topbar-inicio` pasa a **translúcida con blur** + línea inferior (ver
   * `globals.css`). Se resuelve con una clase en el `<html>` —mismo patrón que
   * `fp-sin-red`— y no con estado compartido: la barra vive en el **layout** y la
   * página en el **route**, así no dependemos de que un módulo de estado sea la
   * misma instancia en los dos bundles.
   */
  const enInicio = pathname === "/dashboard";

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
      // `data-topbar` lo usa `AnclajeBarras` (anclaje al borde visible).
      data-topbar=""
      className={cn(
        "fixed top-0 right-0 left-0 z-50 border-b transition-[background-color,border-color] duration-200",
        // Resto de la app: la barra sólida de siempre. En Inicio manda
        // `.topbar-inicio` (transparente en el top / translúcida con scroll).
        enInicio ? "topbar-inicio" : "border-border bg-sidebar"
      )}
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
            // Área táctil de **44×44** (mínimo de Apple HIG; Material pide 48): el
            // círculo sigue midiendo 32 px —los 6 px de padding de cada lado son
            // los que se tocan— y `-mr-1.5` compensa el padding de la derecha para
            // que el círculo quede **exactamente** donde estaba (alineado con el
            // margen del logo). El gesto de tocar "un poco al lado" del avatar
            // entraba en el borde del `<header>` y no abría nada (2026-10-07).
            className="-mr-1.5 ml-1 inline-flex items-center justify-center rounded-full p-1.5 transition-opacity hover:opacity-90"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#414346] text-[15px] text-[#f0f1f2]"
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
