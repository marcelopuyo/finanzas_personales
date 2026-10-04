import type { ReactNode } from "react";

interface PanelHeaderProps {
  /** Nombre de la pantalla (ej. "Gastos"). Va como **contexto**, no como título. */
  titulo: string;
  /** Aclaración del número (ej. `"mes actual"`). Se muestra tras un `·`. */
  contexto?: string;
  /** **Número protagonista** del panel (ya formateado). */
  numero?: ReactNode;
  /** Controles de la derecha de la primera línea (Filtros, ⋯). */
  acciones?: ReactNode;
  /** Selector de pestañas del panel: va a la derecha del número. */
  tabs?: ReactNode;
  /**
   * Clases del contenedor. Los **mini-paneles** no pasan nada (el recuadro ya da el
   * aire); dentro del panel del gráfico se pasa `mb-4`.
   */
  className?: string;
}

/**
 * **Encabezado de un panel del dashboard — diseño "C"** (decisión del usuario,
 * 2026-10-03, rama `rediseno-ui`).
 *
 * Dos cambios de raíz respecto del armado anterior:
 *
 * 1. **El encabezado vive DENTRO del panel.** Antes el título, el badge, los
 *    Filtros y el ⋯ formaban una **tarjeta aparte arriba** del panel del gráfico
 *    ⇒ se leían dos paneles y se perdía alto. Ahora se pasa como `encabezado` del
 *    gráfico (`EvolutionChart` · `DonutChart` · `PrestamosChart`), que lo pinta
 *    dentro de su propio recuadro.
 * 2. **El número es el protagonista y el título pasa a contexto.** El nombre de la
 *    pantalla se muestra chico y en gris (13px) y el **monto** toma el lugar del
 *    título (22px). El **badge `StatBadge` se eliminó**: mostraba el mismo número
 *    que ahora encabeza el panel.
 *
 * ⚠️ **Sin negritas** (regla del usuario, misma fecha): acá no hay `font-semibold`
 * ni `font-bold` — la jerarquía la dan **tamaño, color y aire**, no el peso.
 */
export function PanelHeader({
  titulo,
  contexto,
  numero,
  acciones,
  tabs,
  className,
}: PanelHeaderProps) {
  return (
    <div className={className}>
      {/* Línea 1: contexto (nombre de la pantalla) + controles. Se mantiene como
          `<h1>` —es el título de la pantalla— aunque visualmente sea chico y gris. */}
      <div className="flex items-center gap-3">
        <h1 className="min-w-0 text-[13px] leading-5 text-subtitle">
          {titulo}
          {contexto ? ` · ${contexto}` : ""}
        </h1>
        {acciones && (
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {acciones}
          </div>
        )}
      </div>

      {/* Línea 2: el número protagonista + las pestañas del panel. **Sin número ni
          pestañas no se pinta**: si no, quedaría una línea vacía de 28 px (caso del
          panel Resultados, que ahora va solo con el rótulo — §216). */}
      {(numero != null || tabs) && (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
          {numero != null && (
            <p className="text-[22px] leading-7 tracking-tight text-value tabular-nums">
              {numero}
            </p>
          )}
          {tabs && <div className="ml-auto">{tabs}</div>}
        </div>
      )}
    </div>
  );
}
