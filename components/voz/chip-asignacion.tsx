"use client";

/**
 * Chip de un campo que el dictado completó ("Monto $ 3.500").
 *
 * Es **solo presentacional**: el contenido lo arma `DictadoCampos`, que es quien
 * conoce la config y puede resolver el valor "lindo" (la etiqueta de la opción,
 * el monto formateado, la fecha en dd/mm/aaaa).
 */
export function ChipAsignacion({
  etiqueta,
  valor,
  nota,
}: {
  etiqueta: string;
  valor: string;
  /** Aclaración chica (p. ej. "del último gasto", cuando no salió de la frase). */
  nota?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px]">
      <span className="text-subtitle">{etiqueta}</span>
      <span className="font-medium text-card-foreground">{valor}</span>
      {nota && <span className="text-[10px] text-subtitle italic">{nota}</span>}
    </span>
  );
}
