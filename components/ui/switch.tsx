"use client";

import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  /** Label accesible (aria-label); útil cuando no hay texto visible (p. ej. en tablas). */
  ariaLabel?: string;
}

/**
 * Toggle tipo píldora (interruptor) estilo DeepSeek.
 * - Encendido: track verde semitransparente con ícono ✓ y knob blanco a la derecha.
 * - Apagado: track rojo semitransparente con ícono ✕ y knob blanco a la izquierda.
 * Compacto (bajo y ancho), con transición suave, hover, foco visible y escala al presionar.
 */
export function Switch({
  checked,
  onChange,
  label,
  id,
  className,
  disabled = false,
  ariaLabel,
}: SwitchProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "group inline-flex cursor-pointer select-none items-center gap-2.5",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        disabled && "cursor-not-allowed opacity-60",
        className
      )}
    >
      <span
        className={cn(
          "relative h-4 w-12 shrink-0 rounded-full border transition-colors duration-200",
          checked
            ? "border-success/60 bg-success/25"
            : "border-danger/50 bg-danger/30",
          "group-hover:opacity-90 group-active:opacity-80"
        )}
      >
        {/* Ícono del estado (✓ activado / ✕ desactivado) */}
        <span
          className={cn(
            "pointer-events-none absolute inset-y-0 flex items-center transition-all duration-200",
            checked ? "left-2" : "right-2"
          )}
        >
          {checked ? (
            <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
          ) : (
            <X className="h-2.5 w-2.5 text-white/70" strokeWidth={3} />
          )}
        </span>
        {/* Knob deslizante */}
        <span
          className={cn(
            "pointer-events-none absolute h-3.5 w-3.5 rounded-full bg-white shadow-sm ring-1 ring-black/10 transition-all duration-200 ease-out",
            checked ? "left-8" : "left-0.5",
            "group-hover:shadow-md group-active:scale-95"
          )}
        />
      </span>
      {label && (
        <span className="text-[13px] text-card-foreground">{label}</span>
      )}
    </button>
  );
}
