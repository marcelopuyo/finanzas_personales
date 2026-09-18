"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LinkNavStatus } from "@/components/ui/nav-progress";
import { Briefcase, Ellipsis } from "lucide-react";

/**
 * Menú desplegable (⋯) del panel "Trabajo" del dashboard (períodos), ubicado en
 * la esquina superior derecha del panel con la misma estética que el de
 * Cuentas/Préstamos. Desde 2026-09-17 el panel completo abre el CRUD de períodos
 * al hacer clic en cualquier punto, así que este menú **corta el `click`** para
 * quedar excluido de esa acción.
 *
 * Solo gestiona TRABAJOS: los PERÍODOS se abren desde las propias tarjetas del
 * panel (Por cobrar / Actuales → popup del listado; Finalizados → CRUD filtrado
 * por los ya cobrados), así que la opción "Gestionar períodos" se quitó
 * (2026-09-10).
 */
export function TrabajosActionsMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    // El clic sobre el menú NO debe llegar al panel: desde 2026-09-17 el panel
    // "Trabajo" entero navega al CRUD de períodos y el ⋯ (con su desplegable)
    // queda afuera de esa acción.
    <div
      className="relative shrink-0"
      ref={menuRef}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Acciones de trabajo"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Acciones de trabajo"
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
            href="/cruds/trabajos?origen=dashboard"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-card-foreground transition-colors hover:bg-muted"
          >
            <Briefcase className="h-4 w-4 text-subtitle" />
            Gestionar trabajos
            <LinkNavStatus />
          </Link>
        </div>
      )}
    </div>
  );
}
