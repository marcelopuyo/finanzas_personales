// Modelo de fila del **Detalle de Ingresos** del dashboard (2026-09-30).
//
// El Detalle mezcla las dos cosas que existen en el circuito (pedido del
// usuario, 2026-09-30):
//
//  · **`cobrado`**   → una **liquidación** (nace sólo cuando hubo cobro).
//  · **`pendiente`** → un **grupo de ítems sin liquidar de un mismo trabajo**:
//    lo trabajado que todavía no entró ⇒ va con el **monto en ROJO** y
//    "Sin cobrar", así las últimas jornadas se ven antes de que su período se
//    cierre/cobre.
//
// ⚠️ El **Total** del listado completo (pantalla `/trabajo`) suma sólo lo
// COBRADO: los pendientes son parte del *devengo* del mes (dona y badge, §190) y
// de la tarjeta "Por cobrar", pero no de los cobros.
//
// Módulo **puro** (sin React ni BD): lo consumen las **tarjetas** del Detalle
// (`ingresos-tarjetas.tsx`). La grilla anterior quedó **archivada** en
// `archivo/app/(app)/dashboard/components/ingresos-detalle.tsx`.

import type { LiquidacionOut } from "@/backend/src/queries/trabajos";
import { ymd } from "@/backend/src/lib/ingresos-trabajo";
import { dateTimeToString } from "@/lib/utils";
import type { GrupoPendienteIngresos } from "../ingresos-pendientes";

/** Una fila del Detalle de Ingresos: una liquidación cobrada o un grupo pendiente. */
export type FilaDetalleIngresos =
  | { tipo: "cobrado"; liq: LiquidacionOut }
  | { tipo: "pendiente"; grupo: GrupoPendienteIngresos };

/** ¿La fila es una liquidación (cobrada) o un grupo de ítems sin cobrar? */
export const esCobrado = (fila: FilaDetalleIngresos) => fila.tipo === "cobrado";

/** Inicio del rango de la fila ("YYYY-MM-DD"): el `fechaDesde` de la liquidación o del grupo. */
export function fechaDesdeDe(fila: FilaDetalleIngresos): string {
  return esCobrado(fila) ? ymd(fila.liq.fechaDesde) : fila.grupo.fechaDesde;
}

/** Fin del rango de la fila ("YYYY-MM-DD"). */
export function fechaHastaDe(fila: FilaDetalleIngresos): string {
  return esCobrado(fila) ? ymd(fila.liq.fechaHasta) : fila.grupo.fechaHasta;
}

/** Monto de la fila: lo cobrado (liquidación) o lo pendiente del grupo. */
export function montoDeFila(fila: FilaDetalleIngresos): number {
  if (!esCobrado(fila)) return fila.grupo.monto;
  return fila.liq.montoCobrado ?? fila.liq.montoCalculado ?? 0;
}

/** Σ de las propinas de las jornadas de la liquidación (las **tareas** no llevan propina). */
export function propinaDeLiquidacion(p: LiquidacionOut): number {
  return (p.jornadas ?? []).reduce((acc, j) => acc + (j.montoPropina ?? 0), 0);
}

/** Propina de la fila (Σ de las jornadas de la liquidación o del grupo pendiente). */
export function propinaDeFila(fila: FilaDetalleIngresos): number {
  return esCobrado(fila) ? propinaDeLiquidacion(fila.liq) : fila.grupo.propina;
}

/**
 * Fecha de cobro de la fila ("YYYY-MM-DD") o **""** si no hay cobro real: un
 * grupo pendiente no la tiene y una liquidación puede venir sin `fechaDeCobro`
 * (o con el "cero" de las filas históricas, que el modelo guarda como año < 1901).
 * Es el discriminador del color del monto: **verde = cobrado · rojo = sin cobrar**.
 */
export function fechaCobroDe(fila: FilaDetalleIngresos): string {
  if (!esCobrado(fila) || !fila.liq.fechaDeCobro) return "";
  const d = new Date(fila.liq.fechaDeCobro);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1901) return "";
  return ymd(d);
}

/** Nombre del trabajo de la fila (`""` si no se pudo resolver). */
export function trabajoDeFila(fila: FilaDetalleIngresos): string {
  return esCobrado(fila) ? fila.liq.trabajo?.nombre ?? "" : fila.grupo.trabajo;
}

/** Cantidad de ítems de la fila (jornadas, tareas) — alimenta el rótulo del conteo. */
export function itemsDeFila(fila: FilaDetalleIngresos): {
  jornadas: number;
  tareas: number;
} {
  return esCobrado(fila)
    ? { jornadas: fila.liq.jornadas?.length ?? 0, tareas: fila.liq.tareas?.length ?? 0 }
    : { jornadas: fila.grupo.jornadas, tareas: fila.grupo.tareas };
}

// ─────────────────────────────────────────────────────────────
// Sparkline de la fila ("Jornadas/Tareas" del Detalle)
// ─────────────────────────────────────────────────────────────

/** Etiqueta del tooltip de una barra. */
export interface BarraActividad {
  /** Fecha del ítem: en las jornadas "YYYY-MM-DD" (el sparkline la formatea a
   *  `dd-mm-aa`) y en las tareas "YYYY-MM-DD hh:mm" (se muestra tal cual). */
  label: string;
  /** Valor de la barra: en las **jornadas** incluye la propina. */
  monto: number;
}

/** Formatea un instante (fecha/hora efectiva de una tarea) a "dd-mm hh:mm" LOCAL. */
function fechaHoraLabel(value: string | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
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
    .map((t) => ({
      label: fechaHoraLabel(t.fechaHoraTarea),
      monto: t.montoTarea || 0,
    }));
}

/**
 * Barras de un **grupo PENDIENTE** (fila "Sin cobrar"): una por ítem sin
 * liquidar, por su fecha (2026-09-30 — pedido del usuario: esas filas también
 * muestran el **sparkline**, igual que las cobradas).
 */
function barrasDeGrupoPendiente(g: GrupoPendienteIngresos): BarraActividad[] {
  return g.items
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
    .map((i) => ({
      label: dateTimeToString(i.fecha),
      monto: i.tipo === "jornada" ? i.monto + i.propina : i.monto,
    }));
}

/**
 * Barras del sparkline de una fila, sea **liquidación** (una barra por jornada —
 * con su propina — o por tarea) o **grupo pendiente** (una barra por ítem sin
 * liquidar). Mismo gráfico que la columna "Jornadas/Tareas" de la grilla vieja.
 */
export function barrasDeFila(fila: FilaDetalleIngresos): BarraActividad[] {
  return esCobrado(fila)
    ? barrasDeItems(fila.liq.jornadas, fila.liq.tareas)
    : barrasDeGrupoPendiente(fila.grupo);
}
