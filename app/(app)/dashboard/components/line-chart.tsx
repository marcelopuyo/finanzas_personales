"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import {
  LineChart,
  Line,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartTooltip, type SerieTooltip } from "./chart-tooltip";
import { useHideTooltipOnTouch } from "./use-hide-tooltip-on-touch";
import { cn } from "@/lib/utils";

/** Una **serie secundaria** de `EvolutionChart` (comparación). */
export interface SerieSecundaria {
  /**
   * `dataKey` del dato extra de cada fila de `data` (además de `name` y
   * `value`), ej. `"ingresos"`. Recharts lo lee del objeto, por eso `data` no
   * necesita declararlo.
   */
  key: string;
  /** Rótulo de la serie en la leyenda y el tooltip. */
  label: string;
  /** Color del trazo (default `var(--muted-foreground)`). */
  color?: string;
}

interface EvolutionChartProps {
  /** Título del panel. Opcional si se pasa `encabezado`. */
  title?: string;
  /** Filas del gráfico: `name` (eje X) + `value` (serie principal). */
  data: { name: string; value: number }[];
  color?: string;
  /** Px del área del gráfico (o `"100%"` para llenar un contenedor con alto). */
  height?: number | `${number}%`;
  className?: string;
  action?: ReactNode;
  badge?: ReactNode;
  area?: boolean;
  /** Código ISO para formatear el tooltip (default ARS). */
  currency?: string;
  /**
   * **Reemplaza TODO el encabezado del panel** (2026-10-01, `rediseno-ui`): el
   * rediseño deja dentro del panel solo su **selector de pestañas**, y el título,
   * el badge, los Filtros y el ⋯ pasan a una **fila suelta arriba de la pantalla**
   * (`dashboard-client.tsx`). Con `null` el panel no pinta ningún encabezado.
   */
  encabezado?: ReactNode;
  /**
   * **Sin el recuadro del panel** (fondo, borde y padding): lo usa la **banda de
   * Inicio** (2026-10-02), donde el gráfico va a sangre sobre el hero.
   */
  sinRecuadro?: boolean;
  /**
   * **Modo mínimo** (banda de Inicio): deja **solo la serie** — sin rótulos de
   * los ejes X/Y ni líneas horizontales de grilla (el tooltip sigue andando).
   */
  minimo?: boolean;  /**
   * **El dedo sobre el gráfico NO arrastra el contenedor horizontal**
   * (`touch-action: pan-y`): lo usa la **banda de Inicio**, donde el pedido del
   * usuario (2026-10-03) es que el gesto lateral sobre el gráfico **scrubbee el
   * tooltip en vez de mover el carrusel**. El scroll vertical sigue normal.
   */
  sinScrollLateral?: boolean;
  /**
   * **Series secundarias** (2026-10-09, panel Resultados): se dibujan con **menos
   * jerarquía** que la principal — trazo fino y semitransparente, **sin relleno** y
   * **sin puntos** — para compararlas contra ella sin competir; además van
   * **debajo** (la principal se pinta última y queda arriba). Si el dato de la
   * serie viene **en negativo** (gastos), la línea se dibuja **bajo el eje**.
   * Con al menos una se pinta la **leyenda** y el tooltip pasa a listar **una fila
   * por serie**.
   */
  seriesSecundarias?: SerieSecundaria[];
  /**
   * Rótulo de la serie **principal** en la leyenda y el tooltip (default
   * `"Total"`). Sólo se usa cuando hay `seriesSecundarias`.
   */
  etiquetaPrincipal?: string;
  /**
   * **Scroll horizontal a partir de N puntos** (2026-10-09): con **más puntos que
   * este umbral** el gráfico deja de comprimirse — se dibuja a `n × 56 px` dentro
   * de un contenedor que scrollea — y el **eje Y queda FIJO** a la izquierda (un
   * gráfico "regla" del ancho justo del eje, alineado con el que scrollea: mismo
   * alto de eje X y mismo **dominio**, que se calcula una vez para los dos).
   * Sin la prop el gráfico **no scrollea nunca** (sparklines de las tarjetas,
   * banda de Inicio).
   * ⚠️ Con scroll, el dedo **arrastra el gráfico** en horizontal (es lo que
   * permite moverse): el tooltip se sigue viendo con un tap, pero ya no se
   * "scrubea" arrastrando.
   */
  scrollDesde?: number;
}

/**
 * Ancho en px **por punto** cuando el gráfico scrollea (56: los rótulos
 * `"sep-2026"` entran sin pisarse).
 */
const ANCHO_POR_PUNTO = 56;

/** Ancho del carril del **eje Y fijo** (los rótulos tipo `-250000` entran justos). */
const ANCHO_EJE_Y = 56;

/**
 * Alto reservado por el **eje X**, igual en los DOS gráficos del scroll: si
 * difiriera, las áreas de dibujo no coincidirían y las líneas no caerían sobre
 * las líneas de la grilla. Es el default de recharts (30), declarado para que se
 * vea de dónde sale la alineación.
 */
const ALTO_EJE_X = 30;

/**
 * **Umbral que usan los paneles del dashboard** para pasar `scrollDesde`: desde
 * **13 meses** el gráfico ya no entra cómodo en un celular (12 columnas de ~56 px
 * dan ~670 px, más de lo que hay de ancho útil).
 */
export const MESES_SCROLL = 12;

export function EvolutionChart({
  title,
  data,
  color = "var(--primary)",
  height = 300,
  className = "",
  action,
  badge,
  area = false,
  currency,
  encabezado,
  sinRecuadro = false,
  minimo = false,
  sinScrollLateral = false,
  seriesSecundarias,
  etiquetaPrincipal = "Total",
  scrollDesde,
}: EvolutionChartProps) {
  /** Wrapper: con `sinRecuadro` queda transparente (banda de Inicio). */
  const caja = sinRecuadro
    ? className
    : `rounded-lg border border-border bg-card p-5 ${className}`;
  // El tooltip se oculta al levantar el dedo en mobile (ver el hook).
  const touchReset = useHideTooltipOnTouch();

  /**
   * 📈 **Dominio ajustado a los datos** (2026-10-03, bug reportado en prod): con el
   * dominio por defecto (`[0, auto]`) una serie de **saldos altos y con poca
   * variación** queda aplastada contra el borde superior —el caso real de las
   * cuentas: 2 puntos, 4.700 → 6.000 ⇒ la curva quedaba a 17px del techo de 128 y
   * el gráfico **se veía vacío**—. En el **modo mínimo** (banda de Inicio) se usa el
   * rango real con un 15% de aire, así la tendencia ocupa todo el alto.
   * ⚠️ Con todos los valores iguales (o uno solo) el rango sería 0 ⇒ se fuerza un
   * aire mínimo para que el eje no colapse.
   */
  const dominio = useMemo<[number, number] | undefined>(() => {
    if (!minimo || data.length === 0) return undefined;
    const valores = data.map((d) => d.value);
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const aire = (max - min) * 0.15 || Math.max(Math.abs(max) * 0.05, 1);
    return [min - aire, max + aire];
  }, [minimo, data]);

  /**
   * Con **1 a 3 puntos** no hay curva que leer (una recta entre 2 puntos casi no se
   * distingue del fondo): se dibujan los puntos para que la serie sea visible.
   */
  const mostrarPuntos = minimo && data.length <= 3;

  /**
   * **Scroll horizontal** activo: más puntos que el umbral y no es el modo mínimo.
   */
  const conScroll =
    !minimo && scrollDesde !== undefined && data.length > scrollDesde;

  /** Series que hay que declarar en cada gráfico para que **compartan escala**. */
  const clavesDeSeries = ["value", ...(seriesSecundarias ?? []).map((s) => s.key)];

  /**
   * **Cuerpo del gráfico**: grilla, ejes, tooltip y series. Se usa en los DOS
   * gráficos del scroll (`ejeY: "oculto"` = el que scrollea, donde el eje va fijo
   * aparte) y en el de siempre. En el que scrollea el eje Y va **oculto** (`hide`):
   * no ocupa lugar, pero **fija la escala** — sin él recharts crearía su propio eje
   * por defecto y las escalas divergirían.
   */
  const cuerpo = (ejeY: "visible" | "oculto") => (
    <>
      {!minimo && (
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="var(--border)"
        />
      )}
      <XAxis
        dataKey="name"
        hide={minimo}
        // En el scroll el alto del eje X se FIJA igual en los dos gráficos: si no,
        // las áreas de dibujo no coinciden y las líneas no caen sobre la grilla.
        height={conScroll ? ALTO_EJE_X : undefined}
        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
        axisLine={false}
        tickLine={false}
      />
      {ejeY === "visible" ? (
        <YAxis
          hide={minimo}
          // Con los ejes ocultos la serie toca los bordes: se le deja aire.
          padding={minimo ? { top: 12, bottom: 12 } : undefined}
          domain={dominio}
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
      ) : (
        <YAxis hide />
      )}
      <Tooltip content={<ChartTooltip currency={currency} series={series} />} />
      {/* Secundarias PRIMERO: en recharts el orden de los hijos es el orden de
          pintado ⇒ la principal (área o línea) queda por encima. Trazo fino y
          sin relleno: la jerarquía la marca el trazo, no el sombreado. */}
      {seriesSecundarias?.map((s) => (
        <Line
          key={s.key}
          type="monotone"
          dataKey={s.key}
          name={s.label}
          stroke={colorSecundaria(s)}
          strokeWidth={GROSOR_SECUNDARIA}
          strokeOpacity={OPACIDAD_SECUNDARIA}
          dot={false}
          activeDot={{
            r: 2.5,
            fill: colorSecundaria(s),
            stroke: "none",
            fillOpacity: 0.8,
          }}
        />
      ))}
      {area ? (
        <>
          <defs>
            <linearGradient id="evolutionArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill="url(#evolutionArea)"
            dot={mostrarPuntos ? { r: 2.5, fill: color } : false}
            activeDot={{ r: 4, fill: color }}
          />
        </>
      ) : (
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={mostrarPuntos ? { r: 2.5, fill: color } : false}
          activeDot={{ r: 4, fill: color }}
        />
      )}
    </>
  );

  /** Color de una serie secundaria (gris atenuado si no se indica). */
  const colorSecundaria = (s: SerieSecundaria) =>
    s.color ?? "var(--muted-foreground)";

  /**
   * Trazo de las **secundarias**: fino y **semitransparente** (2026-10-09, pedido
   * del usuario) para que **destaquen menos** que la principal (`2 px`, opacidad
   * plena y con sombreado). Son los dos números que hay que tocar para subir o
   * bajarles el protagonismo.
   */
  const GROSOR_SECUNDARIA = 1.2;
  const OPACIDAD_SECUNDARIA = 0.55;

  /**
   * Series para la **leyenda** y el **tooltip**: la principal (`value`) primero y
   * las secundarias después. `undefined` sin secundarias ⇒ el tooltip sigue
   * mostrando el total (comportamiento de siempre en Gastos/Ingresos).
   */
  const series: SerieTooltip[] | undefined = seriesSecundarias?.length
    ? [
        { dataKey: "value", label: etiquetaPrincipal, color, principal: true },
        ...seriesSecundarias.map((s) => ({
          dataKey: s.key,
          label: s.label,
          color: colorSecundaria(s),
        })),
      ]
    : undefined;
  const header =
    encabezado !== undefined ? (
      encabezado
    ) : (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      {/* En MOBILE este grupo ocupa todo el ancho del panel: así lo que se alinee
          a la derecha dentro del `badge` (hoy: el botón ⋯ del panel Gastos) queda
          pegado al borde superior derecho. En desktop vuelve a shrink-to-fit. */}
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <h3 className="text-[16px] text-header">{title}</h3>
        {badge}
      </div>
      {action && (
        // Mobile: el grupo ocupa todo el ancho del panel para que el botón ⋯
        // (que se pega al borde derecho con `ml-auto`) quede siempre en la
        // misma posición. En desktop vuelve a shrink-to-fit (a la derecha).
        <div className="flex w-full items-center gap-2 sm:w-auto">{action}</div>
      )}
    </div>
  );

  if (!data.length) {
    return (
      <div className={caja}>
        {header}
        <div
          className={`flex ${
            sinRecuadro ? "h-28" : "h-64"
          } items-center justify-center text-[13px] text-subtitle`}
        >
          Sin datos disponibles
        </div>
      </div>
    );
  }

  return (
    <div
      onTouchStart={touchReset.onTouchStart}
      onTouchEnd={touchReset.onTouchEnd}
      onTouchCancel={touchReset.onTouchCancel}
      // Con `pan-y` el navegador no se queda con el gesto horizontal: el dedo
      // sobre el gráfico scrubbea el tooltip y NO mueve el carrusel de Inicio.
      style={sinScrollLateral ? { touchAction: "pan-y" } : undefined}
      className={caja}
    >
      {header}
      {/* Leyenda: sólo con series secundarias (una sola serie no necesita
          rótulo: el nombre lo da el panel). Los puntos son el mismo color del
          trazo y la serie principal va con más peso. */}
      {series && (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          {series.map((s) => (
            <span
              key={s.dataKey}
              className={cn(
                "flex items-center gap-1.5 text-[11px]",
                s.principal ? "text-card-foreground" : "text-subtitle"
              )}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: s.color }}
              />
              {s.label}
            </span>
          ))}
        </div>
      )}
      {conScroll ? (
        <div className="flex">
          {/* ── Eje Y FIJO: sólo el eje, del ancho justo de sus rótulos ── */}
          <div className="shrink-0" style={{ width: ANCHO_EJE_Y }}>
            <ResponsiveContainer width="100%" height={height}>
              <ComposedChart data={data}>
                {/* Reserva el MISMO alto de eje X que el gráfico que scrollea. */}
                <XAxis
                  dataKey="name"
                  height={ALTO_EJE_X}
                  tick={false}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  width={ANCHO_EJE_Y - 6}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                {/*
                  ⚠️ Las MISMAS series que el gráfico que scrollea, pero
                  **invisibles**, por dos motivos medidos en el navegador:
                  1. recharts **no pinta un eje** que no tenga ninguna serie
                     asociada ⇒ sin esto el carril queda vacío;
                  2. el **dominio** de un eje se calcula con las series que declara
                     *ese* chart ⇒ declarando las mismas, los dos calculan la MISMA
                     escala y los rótulos caen justo sobre la grilla (sin fijar un
                     `domain` a mano, que dejaba rótulos impares tipo `-241500`).
                */}
                {clavesDeSeries.map((key) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke="transparent"
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {/* ── El gráfico: ancho por punto ⇒ el contenedor scrollea solo ── */}
          <div
            className="min-w-0 flex-1 overflow-x-auto"
            // `pan-x pan-y`: el gráfico se mueve en horizontal y la página sigue
            // scrolleando en vertical. El dedo ya no "scrubea" el tooltip (ahora
            // arrastra el gráfico): el tap sigue mostrándolo.
            style={{ touchAction: "pan-x pan-y" }}
          >
            <div
              style={{ width: `max(100%, ${data.length * ANCHO_POR_PUNTO}px)` }}
            >
              <ResponsiveContainer width="100%" height={height}>
                <ComposedChart data={data}>{cuerpo("oculto")}</ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data}>{cuerpo("visible")}</ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

interface MultiLineChartProps {
  title: string;
  data: { name: string; ingresos: number; gastos: number; resultado: number }[];
  height?: number;
  className?: string;
  action?: ReactNode;
  badge?: ReactNode;
}

export function MultiLineChart({
  title,
  data,
  height = 300,
  className = "",
  action,
  badge,
}: MultiLineChartProps) {
  // El tooltip se oculta al levantar el dedo en mobile (ver el hook).
  const touchReset = useHideTooltipOnTouch();
  const header = (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h3 className="text-[16px] text-header">{title}</h3>
        {badge}
      </div>
      {action}
    </div>
  );

  if (!data.length) {
    return (
      <div className={`rounded-lg border border-border bg-card p-5 ${className}`}>
        {header}
        <div className="flex h-64 items-center justify-center text-[13px] text-subtitle">
          Sin datos disponibles
        </div>
      </div>
    );
  }

  return (
    <div
      onTouchStart={touchReset.onTouchStart}
      onTouchEnd={touchReset.onTouchEnd}
      onTouchCancel={touchReset.onTouchCancel}
      className={`rounded-lg border border-border bg-card p-5 ${className}`}
    >
      {header}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--border)"
          />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "13px",
              color: "var(--card-foreground)",
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="ingresos"
            name="Ingresos"
            stroke="var(--success)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="gastos"
            name="Gastos"
            stroke="var(--danger)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="resultado"
            name="Resultado"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
