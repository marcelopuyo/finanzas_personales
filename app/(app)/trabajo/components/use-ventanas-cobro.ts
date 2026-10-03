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
import type { FechaCobroEstimada } from "./periodos-grid";

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
 * Devuelve, por trabajo, la **fecha estimada de cobro** (opción A, 2026-10-02) más
 * el **total cobrable ahora** (Σ de los bloques `porCobrar`), para la línea
 * "Por cobrar" del resumen de `TrabajoClient`.
 */
export function useVentanasCobro({
  estimacionesSSR,
  hoyServidor,
  items,
  liquidaciones,
  forzar = false,
}: {
  /** Reparto calculado en el server (`dashboard-data.ts`). */
  estimacionesSSR?: EstimacionTrabajo[];
  /** "Hoy" del server (`YYYY-MM-DD`) para saber si hace falta recalcular. */
  hoyServidor?: string;
  /** Ítems pendientes de cobro (jornadas/tareas sin liquidar). */
  items: ItemPendienteFuente[];
  /** Liquidaciones con COBRO REAL (las "cerradas" que usa la inferencia). */
  liquidaciones: LiquidacionCerradaFuente[];
  /**
   * **Fuerza el recálculo en el cliente** (2026-10-03): con el **filtro por
   * trabajo** del panel de Ingresos, las estimaciones del server —que son de
   * **todos** los pendientes— no sirven y hay que repartir solo los filtrados.
   */
  forzar?: boolean;
}): { fechas: Record<string, FechaCobroEstimada>; totalPorCobrar: number } {
  const montado = useMontado();

  const estimaciones = useMemo(() => {
    if (!montado || !hoyServidor || !estimacionesSSR) return estimacionesSSR ?? [];
    const hoyLocal = todayLocalISODate();
    if (!forzar && hoyLocal === hoyServidor) return estimacionesSSR;
    return estimarCobros(items, liquidaciones, hoyLocal || hoyServidor);
  }, [montado, hoyServidor, estimacionesSSR, items, liquidaciones, forzar]);

  return useMemo(() => {
    const fechas: Record<string, FechaCobroEstimada> = {};
    let totalPorCobrar = 0;
    for (const e of estimaciones) {
      // Total cobrable AHORA: Σ de los ítems cuya ventana ya cerró. Los bloques
      // vienen **partidos por ventana** ⇒ el monto es exacto aunque el trabajo
      // tenga también ítems en curso (el caso Atlas).
      totalPorCobrar += e.porCobrar?.monto ?? 0;
      // Opción A (2026-10-02): manda la ventana **en curso/futura** ("cobro
      // estimado"); si no hay, se muestra la ya cerrada ("venció el"). Sin
      // cadencia (`sinPeriodo`) no hay fecha ⇒ no se muestra nada.
      if (e.enCurso?.cierre) {
        fechas[e.trabajo] = { tipo: "enCurso", cierre: e.enCurso.cierre };
      } else if (e.porCobrar?.cierre) {
        fechas[e.trabajo] = { tipo: "porCobrar", cierre: e.porCobrar.cierre };
      }
    }
    return { fechas, totalPorCobrar };
  }, [estimaciones]);
}
