"use client";

import { cn } from "@/lib/utils";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
}

/**
 * Checkbox reutilizable con estilo del tema (accent primario).
 * El input va dentro del label: clic en el texto también alterna.
 */
export function Checkbox({ checked, onChange, label, className }: CheckboxProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5",
        className
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
      />
      <span className="text-[13px] text-card-foreground">{label}</span>
    </label>
  );
}
