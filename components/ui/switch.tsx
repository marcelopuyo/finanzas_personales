"use client";

import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Toggle tipo slider (interruptor) con estilo del tema.
 * - Encendido: knob a la derecha, track primary con leve sombra del knob.
 * - Apagado: knob a la izquierda sobre track border.
 * Con transición suave, hover, foco visible (ring) y escala al presionar.
 */
export function Switch({
  checked,
  onChange,
  label,
  id,
  className,
  disabled = false,
}: SwitchProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
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
          "relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200",
          checked ? "border-primary bg-primary" : "border-border bg-border",
          "group-hover:opacity-90 group-active:opacity-80"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white ring-1 ring-black/5 transition-all duration-200 ease-out",
            checked ? "translate-x-5 shadow-md" : "shadow-sm",
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
