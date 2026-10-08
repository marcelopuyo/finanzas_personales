"use client";

import { useMemo } from "react";
import {
  repartirPendientes,
  type ItemPendienteFuente,
  type LiquidacionCerradaFuente,
  type RepartoPendientes,
} from "@/lib/cobros-estimados";
import { useMontado } from "@/lib/use-cliente";
import { todayLocalISODate } from "@/lib/utils";

/** Monto y **cantidad de ítems** (jornadas + tareas) de una sección del resumen. */
export interface ResumenVentana {
  monto: number;
  items: number;
}

/** Suma una sección al resumen de su ventana (las secciones nulas no existen). */
function sumarSeccion<T extends ItemPendienteFuente>(
  acc: ResumenVentana,
  items: T[] | undefined
): void {
  if (!items?.length) return;
  acc.items += items.length;
  // Redondeo a 2 decimales en cada paso: mismo criterio que `BloqueCobro.monto`.
  acc.monto = Number(
    (acc.monto + items.reduce((a, i) => a + (i.monto ?? 0), 0)).toFixed(2)
  );
}

/**
 * **Ventanas de cobro por trabajo**, calculadas con la fecha **LOCAL** del
 * navegador (2026-10-01, rama `rediseno-ui`).
 *
 * 🔑 Es el fix de **§211** movido a su propio hook: el server (Vercel, **UTC**)
 * repartía los pendientes con SU fecha, que en la tarde-noche ya es la del día
 * siguiente respecto al usuario (21:00 en GMT-4 ⇒ el server está en el día
 * siguiente) ⇒ una ventana que cierra mañana aparecía HOY como cobrable.
 *
 * Con `useMontado()` el recálculo ocurre **después de montar** (en SSR/hidratación
 * se reparte con la fecha del server ⇒ sin desajuste, porque el reparto es
 * **puro**: los mismos ítems + las mismas liquidaciones + la misma fecha dan el
 * mismo corte en los dos lados) y solo si la fecha local difiere de la del server.
 *
 * Devuelve el **reparto de los pendientes por trabajo** (`secciones`, con los ítems
 * adentro: la lista pinta **una fila por ventana**, 2026-10-07) más el **resumen de
 * las dos ventanas** (`porCobrar` / `enCurso`: monto + cantidad de ítems) que pinta
 * `TrabajoClient` arriba de la grilla.
 */
export function useVentanasCobro<T extends ItemPendienteFuente>({
  hoyServidor,
  items,
  liquidaciones,
  forzar = false,
}: {
  /** "Hoy" del **server** (`YYYY-MM-DD`): es el de la primera pintada. */
  hoyServidor?: string;
  /** Ítems pendientes de cobro (jornadas/tareas sin liquidar). */
  items: T[];
  /** Liquidaciones con COBRO REAL (las "cerradas" que usa la inferencia). */
  liquidaciones: LiquidacionCerradaFuente[];
  /**
   * **Fuerza el cálculo con la fecha local** (2026-10-03): con el **filtro por
   * trabajo** del panel de Ingresos los pendientes ya vienen acotados y tanto el
   * reparto como el resumen tienen que salir de ahí.
   */
  forzar?: boolean;
}): {
  secciones: RepartoPendientes<T>[];
  porCobrar: ResumenVentana;
  enCurso: ResumenVentana;
} {
  const montado = useMontado();

  /**
   * Fecha con la que se reparten las ventanas: antes de montar manda la del
   * **server** (SSR e hidratación pintan lo mismo); después, si la local ya cambió
   * (de noche el UTC ya está en el día siguiente), la local.
   */
  const hoy = useMemo(() => {
    if (!montado || !hoyServidor) return hoyServidor || todayLocalISODate();
    if (forzar) return todayLocalISODate() || hoyServidor;
    const hoyLocal = todayLocalISODate();
    return hoyLocal === hoyServidor ? hoyServidor : hoyLocal || hoyServidor;
  }, [montado, hoyServidor, forzar]);

  return useMemo(() => {
    const secciones = repartirPendientes(items, liquidaciones, hoy);
    // Resumen de las dos ventanas: los bloques vienen **partidos por sección** ⇒
    // cada monto es exacto aunque el trabajo tenga ítems en las dos (el caso
    // Duffys). ⚠️ Los ítems **sin período** (`sinPeriodo`) no entran: sin
    // estimación no hay línea que mostrar.
    const porCobrar: ResumenVentana = { monto: 0, items: 0 };
    const enCurso: ResumenVentana = { monto: 0, items: 0 };
    for (const r of secciones) {
      sumarSeccion(porCobrar, r.porCobrar?.items);
      sumarSeccion(enCurso, r.enCurso?.items);
    }
    return { secciones, porCobrar, enCurso };
  }, [items, liquidaciones, hoy]);
}
