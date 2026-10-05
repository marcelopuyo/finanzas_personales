"use client";

import { useMemo } from "react";
import {
  estimarCobros,
  type BloqueCobro,
  type EstimacionTrabajo,
  type ItemPendienteFuente,
  type LiquidacionCerradaFuente,
} from "@/lib/cobros-estimados";
import { useMontado } from "@/lib/use-cliente";
import { todayLocalISODate } from "@/lib/utils";
import type { FechaCobroEstimada } from "./periodos-grid";

/** Monto y **cantidad de ítems** (jornadas + tareas) de una sección del resumen. */
export interface ResumenVentana {
  monto: number;
  items: number;
}

/** Suma un bloque al resumen de su sección (los bloques nulos no existen). */
function sumarBloque(acc: ResumenVentana, b: BloqueCobro | null): void {
  if (!b) return;
  acc.monto += b.monto;
  acc.items += b.jornadas + b.tareas;
}

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
 * el **resumen de las dos ventanas** (`porCobrar` / `enCurso`: monto + cantidad de
 * ítems) que pinta `TrabajoClient` arriba de la grilla.
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
}): {
  fechas: Record<string, FechaCobroEstimada>;
  porCobrar: ResumenVentana;
  enCurso: ResumenVentana;
} {
  const montado = useMontado();

  const estimaciones = useMemo(() => {
    if (!montado || !hoyServidor || !estimacionesSSR) return estimacionesSSR ?? [];
    const hoyLocal = todayLocalISODate();
    if (!forzar && hoyLocal === hoyServidor) return estimacionesSSR;
    return estimarCobros(items, liquidaciones, hoyLocal || hoyServidor);
  }, [montado, hoyServidor, estimacionesSSR, items, liquidaciones, forzar]);

  return useMemo(() => {
    const fechas: Record<string, FechaCobroEstimada> = {};
    // Resumen de las dos ventanas: los bloques vienen **partidos por sección** ⇒
    // cada monto es exacto aunque el trabajo tenga ítems en las dos (el caso
    // Atlas). ⚠️ Los ítems **sin cadencia** (`sinPeriodo`) no entran: sin
    // estimación no hay sección que mostrar.
    const porCobrar: ResumenVentana = { monto: 0, items: 0 };
    const enCurso: ResumenVentana = { monto: 0, items: 0 };
    for (const e of estimaciones) {
      sumarBloque(porCobrar, e.porCobrar);
      sumarBloque(enCurso, e.enCurso);
      // Opción A (2026-10-02): manda la ventana **en curso/futura** ("cobro
      // estimado"); si no hay, se muestra la ya cerrada ("venció el"). Sin
      // cadencia (`sinPeriodo`) no hay fecha ⇒ no se muestra nada.
      if (e.enCurso?.cierre) {
        fechas[e.trabajo] = { tipo: "enCurso", cierre: e.enCurso.cierre };
      } else if (e.porCobrar?.cierre) {
        fechas[e.trabajo] = { tipo: "porCobrar", cierre: e.porCobrar.cierre };
      }
    }
    return { fechas, porCobrar, enCurso };
  }, [estimaciones]);
}
