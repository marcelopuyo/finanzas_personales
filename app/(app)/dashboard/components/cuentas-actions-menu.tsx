"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ellipsis, Settings2 } from "lucide-react";

/**
 * Menú desplegable (⋮) del panel "Cuentas" del dashboard, ubicado en la esquina
 * superior derecha del panel. Permite acceder al CRUD de cuentas ("Gestionar
 * cuentas") navegando con ?origen=dashboard para que, desde el CRUD, el botón
 * "volver" regrese al dashboard (patrón mobile app).
 */
export function CuentasActionsMenu() {
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
        aria-label="Acciones de cuentas"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Acciones de cuentas"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/60 text-subtitle transition-colors hover:bg-muted hover:text-header"
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
            onClick={() => go("/cruds/cuentas?origen=dashboard")}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-card-foreground transition-colors hover:bg-muted"
          >
            <Settings2 className="h-4 w-4 text-subtitle" />
            Gestionar cuentas
          </button>
        </div>
      )}
    </div>
  );
}
