"use client";

import { RefreshCw } from "lucide-react";

/**
 * Overlay de espera que BLOQUEA la pantalla: capa fija por encima de todo (con
 * backdrop + blur), así mientras está visible el usuario no puede tocar nada de
 * lo que hay atrás. Se usa cuando una acción va a la BD y después completa
 * campos del formulario (p. ej. el autocompletado del Gasto Directo).
 */
export function LoadingOverlay({
  show,
  message = "Cargando...",
}: {
  show: boolean;
  message?: string;
}) {
  if (!show) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-60 flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-sm"
    >
      <RefreshCw className="h-6 w-6 animate-spin text-primary" />
      <p className="text-[13px] font-medium text-card-foreground">{message}</p>
    </div>
  );
}
