interface StatBadgeProps {
  label: string;
  value: string;
}

/**
 * Badge compacto (label + valor) para mostrar junto al título de un gráfico,
 * p. ej. "Total actual: $12.500". Estilo tipo tarjeta pequeña con fuente menor.
 */
export function StatBadge({ label, value }: StatBadgeProps) {
  return (
    <div className="rounded-md border border-border bg-muted px-2 py-1">
      <p className="text-[10px] leading-none text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[12px] font-semibold leading-none text-header">
        {value}
      </p>
    </div>
  );
}
