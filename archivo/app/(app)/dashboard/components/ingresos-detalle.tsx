"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import type { LiquidacionOut } from "@/backend/src/queries/trabajos";
import { cn, dateTimeToString, numberToCurrency } from "@/lib/utils";
import type { GrupoPendienteIngresos } from "../ingresos-pendientes";
import { SparkLineChart } from "./sparkline-chart";

function formatCobroDate(value?: string | Date | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (d.getFullYear() < 1901) return "—";
  return dateTimeToString(d);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Formatea un instante (fecha/hora efectiva de una tarea) a "dd-mm hh:mm" LOCAL. */
function fechaHoraLabel(value: string | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/**
 * Importe de la fila: **sólo el monto COBRADO** (2026-09-27). Antes, si el cobro
 * había diferido del calculado, aparecía abajo un "calc. …" con lo que
 * correspondía: se quitó por pedido del usuario (la fila queda más limpia).
 * El `montoCalculado` se conserva únicamente como **respaldo** por si una
 * liquidación no tuviera cobro (en el modelo nuevo nacen cobradas).
 */
function ImporteCell({
  montoCobrado,
  montoCalculado,
  fechaDeCobro,
  propina,
  currency,
}: {
  montoCobrado: number | null;
  montoCalculado: number | null;
  fechaDeCobro?: string | Date | null;
  /** Propina de las jornadas de la liquidación (0 si no tiene). */
  propina: number;
  currency: string;
}) {
  const cobrado =
    !!fechaDeCobro && new Date(fechaDeCobro).getFullYear() >= 1901;
  const monto = (cobrado ? montoCobrado : null) ?? montoCalculado ?? 0;
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span
        className={cn(
          "inline-flex min-w-22 flex-col items-end rounded-full px-2 py-0.5 text-[12px] font-medium",
          cobrado ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
        )}
      >
        {numberToCurrency(monto, currency)}
      </span>
      {/* En MOBILE la columna "Propina" está oculta (`hidden sm:table-cell`), así
          que la propina viaja acá como 2ª línea verde: la tabla no gana ancho. */}
      {propina > 0.005 && (
        <span className="text-[10px] font-medium tabular-nums text-success sm:hidden">
          propina {numberToCurrency(propina, currency)}
        </span>
      )}
    </span>
  );
}

/**
 * Σ de las propinas de las jornadas de la liquidación (las **tareas** no llevan
 * propina). La propina es ingreso devengado de su jornada, pero **no** integra
 * el monto de la liquidación (que liquida sólo las horas): por eso la columna
 * "Propina" la muestra aparte del "Importe".
 */
export function propinaDeLiquidacion(p: LiquidacionOut): number {
  return (p.jornadas ?? []).reduce((acc, j) => acc + (j.montoPropina ?? 0), 0);
}

/**
 * Fila del **Detalle de Ingresos**. El listado mezcla las dos cosas que existen
 * en el circuito (pedido del usuario, 2026-09-30):
 *
 *  · **`cobrado`**   → una **liquidación** (nace sólo cuando hubo cobro).
 *  · **`pendiente`** → un **grupo de ítems sin liquidar de un mismo trabajo**:
 *    lo trabajado que todavía no entró. Va con el **monto en ROJO** y la
 *    aclaración "Sin cobrar", así las últimas jornadas se ven en el Detalle
 *    aunque su período no se haya cerrado/cobrado todavía.
 *
 * ⚠️ El **Total del pie suma sólo lo COBRADO** (por eso el rótulo "Total
 * cobrado"): los pendientes son parte del *devengo* del mes (dona y badge,
 * §190) y de la tarjeta "Por cobrar", pero no de este listado de cobros.
 */
export type FilaDetalleIngresos =
  | { tipo: "cobrado"; liq: LiquidacionOut }
  | { tipo: "pendiente"; grupo: GrupoPendienteIngresos };

const esCobrado = (fila: FilaDetalleIngresos) => fila.tipo === "cobrado";

/** "YYYY-MM-DD" de una fecha (la liquidación viene con `Date`). */
function isoDeFecha(v: string | Date): string {
  return v instanceof Date
    ? v.toISOString().slice(0, 10)
    : String(v).slice(0, 10);
}

/** Inicio del rango de la fila (es el accessor de la columna "Período"). */
function fechaDesdeDe(fila: FilaDetalleIngresos): string {
  return esCobrado(fila) ? isoDeFecha(fila.liq.fechaDesde) : fila.grupo.fechaDesde;
}

/** Fin del rango de la fila. */
function fechaHastaDe(fila: FilaDetalleIngresos): string {
  return esCobrado(fila) ? isoDeFecha(fila.liq.fechaHasta) : fila.grupo.fechaHasta;
}

/** Monto de la fila: lo cobrado (liquidación) o lo pendiente del grupo. */
function montoDeFila(fila: FilaDetalleIngresos): number {
  if (!esCobrado(fila)) return fila.grupo.monto;
  return fila.liq.montoCobrado ?? fila.liq.montoCalculado ?? 0;
}

/** Propina de la fila (Σ de las jornadas de la liquidación o del grupo pendiente). */
export function propinaDeFila(fila: FilaDetalleIngresos): number {
  return esCobrado(fila) ? propinaDeLiquidacion(fila.liq) : fila.grupo.propina;
}

/** Barra del sparkline de la columna "Jornadas/Tareas" (una por ítem). */
export interface BarraActividad {
  /** Etiqueta del tooltip (el sparkline formatea las ISO a `dd-mm-aa`). */
  label: string;
  /** Valor de la barra: en las **jornadas** incluye la propina. */
  monto: number;
}

/** Sparkline de la columna "Jornadas/Tareas" (barras proporcionales). */
export function SparkActividad({
  barras,
  currency,
}: {
  barras: BarraActividad[];
  currency: string;
}) {
  if (barras.length === 0) return <span className="text-subtitle">—</span>;
  return (
    <SparkLineChart
      variant="bar"
      data={barras.map((b) => b.monto)}
      labels={barras.map((b) => b.label)}
      currency={currency}
    />
  );
}

/**
 * Barras de un período con ítems. Discriminador §8: si tiene **jornadas** se
 * grafican las jornadas (incl. históricos tras una conversión); si no, las
 * **tareas** (`por_tarea`). El valor de cada jornada incluye su **propina**.
 */
function barrasDeItems(
  jornadas?: LiquidacionOut["jornadas"],
  tareas?: LiquidacionOut["tareas"]
): BarraActividad[] {
  const jornadasSorted = (jornadas ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(a.fechaJornada).getTime() - new Date(b.fechaJornada).getTime()
    );
  if (jornadasSorted.length > 0) {
    return jornadasSorted.map((j) => ({
      label: dateTimeToString(j.fechaJornada),
      monto: (j.montoJornada || 0) + (j.montoPropina || 0),
    }));
  }
  return (tareas ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(a.fechaHoraTarea).getTime() -
        new Date(b.fechaHoraTarea).getTime()
    )
    .map((t) => ({ label: fechaHoraLabel(t.fechaHoraTarea), monto: t.montoTarea || 0 }));
}

/** Barras de una **liquidación** (fila cobrada del Detalle). */
export function barrasDeLiquidacion(l: LiquidacionOut): BarraActividad[] {
  return barrasDeItems(l.jornadas, l.tareas);
}

/**
 * Barras de un **grupo PENDIENTE** (fila "Sin cobrar" del Detalle): una por
 * ítem sin liquidar, por su fecha (2026-09-30 — pedido del usuario: esas filas
 * también muestran el **sparkline**, igual que las cobradas).
 */
export function barrasDeGrupoPendiente(
  g: GrupoPendienteIngresos
): BarraActividad[] {
  return g.items
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
    .map((i) => ({
      label: dateTimeToString(i.fecha),
      monto: i.tipo === "jornada" ? i.monto + i.propina : i.monto,
    }));
}

/** Celda de actividad de una **liquidación** (se mantiene por compatibilidad). */
export function ActividadCell({
  jornadas,
  tareas,
  currency,
}: {
  jornadas?: LiquidacionOut["jornadas"];
  tareas?: LiquidacionOut["tareas"];
  currency: string;
}) {
  return (
    <SparkActividad barras={barrasDeItems(jornadas, tareas)} currency={currency} />
  );
}

export function ingresosDetalleColumns(
  currency: string
): ColumnDef<FilaDetalleIngresos>[] {
  return [
  {
    id: "trabajo",
    header: "Trabajo",
    accessorFn: (row) =>
      esCobrado(row) ? row.liq.trabajo?.nombre ?? "" : row.grupo.trabajo,
    cell: ({ getValue }) => (getValue<string>() ? getValue<string>() : "-"),
    // El rótulo aclara el criterio: el listado ya no es sólo de liquidaciones
    // (abajo entran los grupos pendientes) y el Total NO los suma.
    footer: "Total cobrado",
  },
  {
    // "Desde" y "Hasta" fusionadas en una sola columna (P1.e): en el modelo nuevo
    // el RANGO es el dato de la liquidación (en `fijo`/`horas_fijas` es declarado
    // y en las variables se deriva de los ítems). El accessor expone `fechaDesde`,
    // así el orden por defecto y el clic en el header son CRONOLÓGICOS (no por el
    // texto "dd-mm-aaaa al ...").
    id: "periodo",
    header: "Período",
    accessorFn: (row) => fechaDesdeDe(row),
    sortingFn: (a, b) =>
      fechaDesdeDe(a.original).localeCompare(fechaDesdeDe(b.original)),
    meta: { align: "center" },
    cell: ({ row }) => {
      const desde = fechaDesdeDe(row.original);
      const hasta = fechaHastaDe(row.original);
      // Un grupo de un solo día (o un período de un día) se muestra con una
      // sola fecha, sin el " al " repetido.
      return desde === hasta
        ? dateTimeToString(desde)
        : `${dateTimeToString(desde)} al ${dateTimeToString(hasta)}`;
    },
  },
  {
    // `id` explícito (no `accessorKey: "montoACobrar"`, que ya no existe): el
    // orden sigue funcionando sobre el monto realmente cobrado.
    id: "importe",
    accessorFn: (row) => montoDeFila(row),
    header: "Importe",
    meta: { align: "right" },
    cell: ({ row }) => (
      // `ImporteCell` ya pinta en ROJO (`bg-danger/10 text-danger`) lo que no
      // tiene cobro real: un grupo pendiente entra directo por esa rama.
      <ImporteCell
        montoCobrado={
          esCobrado(row.original) ? row.original.liq.montoCobrado : null
        }
        montoCalculado={
          esCobrado(row.original)
            ? row.original.liq.montoCalculado
            : row.original.grupo.monto
        }
        fechaDeCobro={
          esCobrado(row.original) ? row.original.liq.fechaDeCobro : null
        }
        propina={propinaDeFila(row.original)}
        currency={currency}
      />
    ),
    footer: ({ table }) => {
      // Sólo lo COBRADO: los pendientes se listan (en rojo) pero no integran el
      // total del listado de cobros.
      const total = table
        .getFilteredRowModel()
        .rows.reduce(
          (acc, row) =>
            acc + (esCobrado(row.original) ? montoDeFila(row.original) : 0),
          0
        );
      return numberToCurrency(total, currency);
    },
  },
  {
    // **Propina** de las jornadas de la liquidación (2026-09-27, pedido del
    // usuario). Es parte del INGRESO devengado (entra en el badge del mes y en
    // el Histórico por la fecha de su jornada) pero **no** del monto de la
    // liquidación —ese liquida sólo las horas—, así que se muestra aparte y en
    // verde, y sólo cuando existe.
    id: "propina",
    header: "Propina",
    accessorFn: (row) => propinaDeFila(row),
    // Sólo en `sm+`: en mobile la propina va como 2ª línea verde del Importe
    // (`ImporteCell`), así la tabla no gana ancho en el celular.
    meta: { align: "right", className: "hidden sm:table-cell" },
    cell: ({ row }) => {
      const propina = propinaDeFila(row.original);
      if (propina <= 0.005) return <span className="text-subtitle">—</span>;
      return (
        <span className="text-[12px] font-medium tabular-nums text-success">
          {numberToCurrency(propina, currency)}
        </span>
      );
    },
    // La propina es el total de la COLUMNA (cobrados + pendientes): es el
    // devengo de las jornadas mostradas, no un subtotal del cobro.
    footer: ({ table }) => {
      const total = table
        .getFilteredRowModel()
        .rows.reduce((acc, row) => acc + propinaDeFila(row.original), 0);
      return total > 0.005 ? numberToCurrency(total, currency) : "—";
    },
  },
  {
    // La liquidación se muestra con su RANGO (columna Período) **además** de la
    // fecha de cobro (P1.e). La vieja columna "Estimación Cobro" se quitó: en el
    // modelo nuevo `fechaEstimadaCobro` no se carga (P1.c).
    id: "cobrado",
    header: "Cobrado",
    accessorFn: (row) =>
      esCobrado(row) && row.liq.fechaDeCobro
        ? isoDeFecha(row.liq.fechaDeCobro)
        : "",
    meta: { align: "center" },
    cell: ({ row }) =>
      esCobrado(row.original) ? (
        formatCobroDate(row.original.liq.fechaDeCobro)
      ) : (
        <span className="text-[12px] font-medium text-danger">Sin cobrar</span>
      ),
  },
  {
    id: "actividad",
    header: "Jornadas/Tareas",
    // La columna del sparkline NO navega al período: el gráfico solo muestra el
    // tooltip de cada barra.
    meta: { align: "center" },
    cell: ({ row }) =>
      esCobrado(row.original) ? (
        <ActividadCell
          jornadas={row.original.liq.jornadas}
          tareas={row.original.liq.tareas}
          currency={currency}
        />
      ) : (
        // Un pendiente no tiene liquidación: se grafica **una barra por ítem sin
        // liquidar**, el mismo sparkline que las filas cobradas.
        <SparkActividad
          barras={barrasDeGrupoPendiente(row.original.grupo)}
          currency={currency}
        />
      ),
  },
  ];
}

export function IngresosDetalle({
  filas,
  currency,
}: {
  filas: FilaDetalleIngresos[];
  currency: string;
}) {
  return (
    <DataTable
      columns={ingresosDetalleColumns(currency)}
      data={filas}
      pageSize={5}
      // Por defecto se ordena por el período más reciente (fecha desde DESC).
      initialSorting={[{ id: "periodo", desc: true }]}
    />
  );
}
