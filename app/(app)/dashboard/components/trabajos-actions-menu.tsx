"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, CalendarRange, Ellipsis } from "lucide-react";

/**
 * Menú desplegable (⋯) del panel "Trabajo" del dashboard (tarjetas sintéticas
 * de períodos), ubicado en la esquina superior derecha del panel con la misma
 * estética que el de Cuentas/Préstamos. Permite crear un nuevo período de
 * trabajo navegando con ?origen=dashboard para que el "volver" regrese al
 * dashboard (patrón mobile app).
 */
export function TrabajosActionsMenu() {
  const router = useRouter();
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

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Acciones de trabajo"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Acciones de trabajo"
        className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-subtitle transition-colors hover:bg-muted hover:text-header"
      >
        <Ellipsis className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => go("/cruds/trabajos?origen=dashboard")}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-card-foreground transition-colors hover:bg-muted"
          >
            <Briefcase className="h-4 w-4 text-subtitle" />
            Gestionar trabajos
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => go("/cruds/periodos-trabajo?origen=dashboard")}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-card-foreground transition-colors hover:bg-muted"
          >
            <CalendarRange className="h-4 w-4 text-subtitle" />
            Gestionar períodos
          </button>
        </div>
      )}
    </div>
  );
}
