import { cn } from "@/lib/utils";

/**
 * Badge de estado reutilizable (Sí/No o con label personalizado).
 * Verde si `ok`, rojo si no. Se usa en listados CRUD (ej. cuentas, usuarios).
 */
export function Badge({
  ok,
  label,
}: {
  ok: boolean;
  label?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium",
        ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          ok ? "bg-success" : "bg-danger"
        )}
      />
      {label ?? (ok ? "Sí" : "No")}
    </span>
  );
}
