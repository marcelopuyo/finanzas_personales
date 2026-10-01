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
