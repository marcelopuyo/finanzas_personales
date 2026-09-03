"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, HandCoins, MoreVertical } from "lucide-react";

/**
 * Menú desplegable (⋮) de acciones de préstamos, ubicado en la esquina superior
 * derecha del panel "Préstamos Pendientes". Como el panel no pertenece a una
 * cuenta puntual, las acciones navegan sin precargar cuenta: el wizard o el
 * formulario piden elegir el préstamo/cuenta según corresponda.
 */
export function PrestamosActionsMenu() {
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
        aria-label="Acciones de préstamos"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Acciones de préstamos"
        className="rounded p-1 text-subtitle transition-colors hover:bg-muted hover:text-header"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => go("/movimientos/nuevo/pago-prestamo")}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-card-foreground transition-colors hover:bg-muted"
          >
            <HandCoins className="h-4 w-4 text-subtitle" />
            Pagar préstamo
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => go("/cruds/prestamos/nuevo?origen=dashboard")}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-card-foreground transition-colors hover:bg-muted"
          >
            <Coins className="h-4 w-4 text-subtitle" />
            Nuevo préstamo
          </button>
        </div>
      )}
    </div>
  );
}
