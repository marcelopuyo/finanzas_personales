interface LogoProps {
  /** Tamaño de la tipografía base (px). El badge se escala proporcional. */
  size?: number;
}

/**
 * Logo de la app, estilo DeepSeek (texto): "finanzas" sin recuadro + "personales"
 * en un recuadro blanco (análogo a "deepseek" + badge "Platform").
 *
 * El wordmark usa la fuente Unbounded (`--font-unbounded`, cargada en
 * `app/layout.tsx`). El badge usa Inter (la UI de la app).
 * Usa tokens del tema (`text-sidebar-foreground`) para adaptarse a claro/oscuro:
 * - Dark: texto claro sobre sidebar oscuro, badge blanco puro con texto oscuro.
 * - Light: texto oscuro sobre sidebar blanco, badge oscuro (#0f172a) con texto blanco.
 */
export default function Logo({ size = 15 }: LogoProps) {
  const badgePadY = Math.max(1, Math.round(size * 0.2));
  const badgePadX = Math.max(4, Math.round(size * 0.55));
  return (
    <div className="flex items-center gap-2">
      <span
        className="text-sidebar-foreground"
        style={{
          fontFamily: "var(--font-unbounded), sans-serif",
          fontSize: size,
          fontWeight: 600,
          letterSpacing: "-0.01em",
        }}
      >
        finanzas
      </span>
      <span
        className="flex items-center justify-center rounded bg-[#0f172a] text-white dark:bg-white dark:text-[#0f172a]"
        style={{
          fontSize: Math.round(size * 0.66),
          fontWeight: 600,
          lineHeight: 1,
          padding: `${badgePadY}px ${badgePadX}px`,
        }}
      >
        personales
      </span>
    </div>
  );
}
