"use client";

import Link from "next/link";
import Logo from "./logo";

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
  return (
    <header className="fixed top-0 right-0 left-0 z-50 flex h-14 items-center justify-between border-b border-border bg-sidebar px-4 sm:px-6">
      <Link
        href="/dashboard"
        aria-label="Ir al resumen"
        title="Resumen"
        className="rounded-lg transition-opacity hover:opacity-90"
      >
        <Logo size={20} />
      </Link>

      <Link
        href="/perfil"
        aria-label={userLabel}
        title={userLabel}
        className="rounded-full transition-opacity hover:opacity-90"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#414346] text-[15px] font-semibold text-[#f0f1f2]"
          style={{ width: 32, height: 32 }}
        >
          {initial}
        </span>
      </Link>
    </header>
  );
}
