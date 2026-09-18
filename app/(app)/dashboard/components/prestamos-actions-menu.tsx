"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LinkNavStatus } from "@/components/ui/nav-progress";
import { useTap } from "@/lib/tap";
import { Coins, Ellipsis, Users } from "lucide-react";

/**
 * Menú desplegable (⋮) de acciones de préstamos, ubicado en la esquina superior
 * derecha del panel "Préstamos Pendientes". "Gestionar préstamos" abre el CRUD
 * de préstamos (su botón por fila "Pagar" lanza el wizard de pago con el
 * préstamo preseleccionado) y "Gestionar personas" abre el CRUD de personas.
 */
export function PrestamosActionsMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // El botón va por **`useTap`** y no por `onClick`: en iOS el toque puede no
  // generar `click` y el menú necesitaba 2-3 toques (2026-09-18, `lib/tap.ts`).
  const tap = useTap(() => setOpen((o) => !o));

  // Cierra el dropdown al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        {...tap}
        aria-label="Acciones de préstamos"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Acciones de préstamos"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/60 text-subtitle transition-colors hover:bg-muted hover:text-header"
      >
        <Ellipsis className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
        >
          <Link
            href="/cruds/prestamos?origen=dashboard"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-card-foreground transition-colors hover:bg-muted"
          >
            <Coins className="h-4 w-4 text-subtitle" />
            Gestionar préstamos
            <LinkNavStatus />
          </Link>
          <Link
            href="/cruds/personas"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-card-foreground transition-colors hover:bg-muted"
          >
            <Users className="h-4 w-4 text-subtitle" />
            Gestionar personas
            <LinkNavStatus />
          </Link>
        </div>
      )}
    </div>
  );
}
