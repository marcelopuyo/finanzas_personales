import { cn } from "@/lib/utils";

/** Bandera de una divisa a partir del código ISO 3166-1 (flag-icons).
 * `pais` null/undefined → no renderiza (monedas sin bandera propia, ej. XOF). */
export function CurrencyFlag({
  pais,
  size = 16,
  className,
}: {
  pais?: string | null;
  size?: number;
  className?: string;
}) {
  if (!pais) return null;
  return (
    <span
      className={cn("fi fis inline-block shrink-0 rounded-[2px]", `fi-${pais}`, className)}
      style={{ fontSize: size }}
      aria-hidden
    />
  );
}
