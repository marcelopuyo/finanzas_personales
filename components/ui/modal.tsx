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
}

/**
 * Modal reutilizable mobile-first: en móvil se comporta como bottom sheet
 * (ancho completo, esquinas superiores redondeadas) y en pantallas sm+
 * como diálogo centrado. Cierra con Escape o al tocar el backdrop.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  className,
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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex max-h-[90dvh] w-full flex-col rounded-t-2xl border border-border bg-card shadow-xl sm:max-w-md sm:rounded-2xl",
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
