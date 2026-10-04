"use client";

import type { AporteCuenta } from "../aportes-balance";

/**
 * **Barra de aporte al balance** — el gráfico de la tarjeta *Balance Actual* de
 * Inicio (2026-10-03, **diseño C** elegido por el usuario sobre el preview
 * `favicons/preview-balance-aporte.html`).
 *
 * Reemplaza a la **dona**: una **barra apilada al 100 %** (12 px de alto) más una
 * **leyenda compacta** con el % de cada cuenta. Dice lo mismo ocupando una
 * fracción del alto, no compite con el monto y los tramos se comparan de un
 * vistazo (la dona a ~90 px se leía mal).
 *
 * ⚠️ **Alto reservado**: se mantiene el mismo bloque de 96 px del resto de las
 * tarjetas (el `track` del carrusel estira todas al alto de la más alta), y la
 * barra + leyenda se **centran** en ese espacio ⇒ la banda no cambia de alto al
 * deslizar.
 *
 * ⚠️ Una barra al 100 % no puede representar aportes **negativos** (cuenta en
 * rojo): se pintan solo los positivos, **normalizados a su propia suma** para que
 * la barra siempre cierre. El listado de abajo sí muestra todas las cuentas.
 */
export function AporteBarra({
  data,
  height = 96,
}: {
  data: AporteCuenta[];
  /** Alto reservado (el mismo de las otras tarjetas, para no mover la banda). */
  height?: number;
}) {
  const tramos = data.filter((d) => d.value > 0);
  const suma = tramos.reduce((acc, d) => acc + d.value, 0);

  if (!tramos.length) {
    return (
      <div
        className="flex items-center justify-center text-[13px] text-subtitle"
        style={{ height }}
      >
        No hay cuentas que aporten al balance.
      </div>
    );
  }

  const pct = (p: number) => `${p.toFixed(1).replace(/\.0$/, "")} %`;

  return (
    <div
      className="flex flex-col justify-center gap-2.5"
      style={{ height }}
      role="img"
      aria-label={`Aporte al balance: ${tramos
        .map((t) => `${t.name} ${pct(t.percent)}`)
        .join(", ")}`}
    >
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/10">
        {tramos.map((t) => (
          <i
            key={t.name}
            className="block h-full"
            style={{
              width: `${(t.value / suma) * 100}%`,
              backgroundColor: t.color,
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        {tramos.map((t) => (
          <span
            key={t.name}
            className="flex items-center gap-1.5 text-[10.5px] text-subtitle"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: t.color }}
            />
            {t.name}
            <b className="font-medium text-value tabular-nums">
              {pct(t.percent)}
            </b>
          </span>
        ))}
      </div>
    </div>
  );
}
