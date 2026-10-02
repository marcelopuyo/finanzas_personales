"use client";

import { useMemo } from "react";
import {
  estimarCobros,
  type EstimacionTrabajo,
  type ItemPendienteFuente,
  type LiquidacionCerradaFuente,
} from "@/lib/cobros-estimados";
import { useMontado } from "@/lib/use-cliente";
import { todayLocalISODate } from "@/lib/utils";
import type { VentanaCobro } from "./periodos-grid";

/**
 * **Ventanas de cobro por trabajo**, calculadas con la fecha **LOCAL** del
 * navegador (2026-10-01, rama `rediseno-ui`).
 *
 * 🔑 Es el fix de **§211** movido a su propio hook: el server (Vercel, **UTC**)
 * reparte los pendientes con SU fecha, que en la tarde-noche ya es la del día
 * siguiente respecto al usuario (21:00 en GMT-4 ⇒ el server está en el día
 * siguiente) ⇒ una ventana que cierra mañana aparecía HOY como cobrable.
 *
 * Con `useMontado()` el recálculo ocurre **después de montar** (en SSR/hidratación
 * se usa el valor del server ⇒ sin desajuste) y solo si la fecha local difiere de
 * la del server.
 *
 * Devuelve un mapa **trabajo → ventanas** para las fichas de la grilla
 * (`PeriodosGrid`). Un trabajo puede caer en más de una ventana (ítems cerrados +
 * ítems en curso).
 */
export function useVentanasCobro({
  estimacionesSSR,
  hoyServidor,
  items,
  liquidaciones,
}: {
  /** Reparto calculado en el server (`dashboard-data.ts`). */
  estimacionesSSR?: EstimacionTrabajo[];
  /** "Hoy" del server (`YYYY-MM-DD`) para saber si hace falta recalcular. */
  hoyServidor?: string;
  /** Ítems pendientes de cobro (jornadas/tareas sin liquidar). */
  items: ItemPendienteFuente[];
  /** Liquidaciones con COBRO REAL (las "cerradas" que usa la inferencia). */
  liquidaciones: LiquidacionCerradaFuente[];
}): Record<string, VentanaCobro[]> {
  const montado = useMontado();

  const estimaciones = useMemo(() => {
    if (!montado || !hoyServidor || !estimacionesSSR) return estimacionesSSR ?? [];
    const hoyLocal = todayLocalISODate();
    if (hoyLocal === hoyServidor) return estimacionesSSR;
    return estimarCobros(items, liquidaciones, hoyLocal);
  }, [montado, hoyServidor, estimacionesSSR, items, liquidaciones]);

  return useMemo(() => {
    const mapa: Record<string, VentanaCobro[]> = {};
    for (const e of estimaciones) {
      for (const id of ["porCobrar", "enCurso", "sinPeriodo"] as const) {
        const bloque = e[id];
        if (!bloque) continue;
        const actuales = mapa[bloque.trabajo] ?? [];
        if (!actuales.includes(id)) actuales.push(id);
        mapa[bloque.trabajo] = actuales;
      }
    }
    return mapa;
  }, [estimaciones]);
}
