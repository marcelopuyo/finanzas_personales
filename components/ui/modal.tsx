"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /**
   * Centra el diálogo **también en mobile**. Por defecto, en mobile el modal es
   * un *bottom sheet* anclado abajo (patrón de la app) y recién en `sm+` se
   * centra; con `centrado` se centra en todas las pantallas y queda más angosto
   * (`max-w-sm`) con margen alrededor. Lo usa el popup de acciones de la cuenta
   * (pedido del usuario, 2026-09-17).
   */
  centrado?: boolean;
}

/**
 * Modal reutilizable mobile-first: en móvil se comporta como bottom sheet
 * (ancho completo, esquinas superiores redondeadas) y en pantallas sm+
 * como diálogo centrado — o centrado en TODAS con `centrado`—. Cierra con
 * Escape o al tocar el backdrop.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  className,
  centrado = false,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex justify-center",
        centrado ? "items-center p-4" : "items-end sm:items-center"
      )}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex max-h-[90dvh] w-full flex-col border border-border bg-card shadow-xl",
          centrado
            ? "max-w-sm rounded-2xl"
            : "rounded-t-2xl sm:max-w-md sm:rounded-2xl",
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-[15px] font-semibold text-header">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-lg p-1.5 text-subtitle transition-colors hover:bg-muted hover:text-header"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer && (
          <div className="border-t border-border px-4 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}
