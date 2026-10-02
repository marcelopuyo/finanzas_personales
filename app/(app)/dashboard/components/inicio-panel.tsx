"use client";

import { useMemo, useRef, useState } from "react";
import { numberToCurrency } from "@/lib/utils";
import { AccountCard } from "./account-card";
import { EvolutionChart } from "./line-chart";
import { FabNuevo } from "@/components/movimientos/fab-nuevo";
import { MovimientosCuentaClient } from "@/app/(app)/cuentas/[id]/movimientos-client";
import type { HistorialPagina } from "@/backend/src/queries/movimientos";
import type { DashboardData } from "../dashboard-data";

/**
 * **Pantalla Inicio** (2026-10-01, rama `rediseno-ui`) — reemplaza los paneles
 * "Balance Actual" + "Cuentas" del dashboard de una sola página.
 *
 * Decisión del usuario (preview aprobado):
 * 1. **Balance** en **una sola línea** y más bajo (descripción ← → monto).
 * 2. **Carrusel de cuentas**: una tarjeta visible + *peek* de la siguiente, con
 *    `scroll-snap` nativo (nunca arrastre por JS: lección §88 del CRUD de períodos).
 * 3. El **sparkline sale de la tarjeta** y se grafica **abajo, full-width**.
 * 4. El **historial de la cuenta en foco** se muestra **en la misma pantalla**, con
 *    scroll infinito (se reusa `MovimientosCuentaClient` de `/cuentas/[id]`), así
 *    no hay que tocar la tarjeta para ver los movimientos.
 *
 * 🔑 La cuenta en foco se define **solo por el swipe**: el toque en la tarjeta no
 * navega (`soloSeleccionar`) y el long press sigue abriendo el popup de acciones.
 * Al cambiar de cuenta, el gráfico y el historial **cambian con ella** (se lee como
 * un solo bloque "cuenta en foco").
 *
 * ⚠️ La cuenta inicial es **la primera del orden configurado** en el CRUD (no se
 * recuerda la última vista).
 */
const PAGINA_VACIA: HistorialPagina = { rows: [], total: 0, hayMas: true };

/** Paso del carrusel en px: ancho de la tarjeta (286) + separación (12, `gap-3`). */
const PASO = 286 + 12;

interface InicioPanelProps {
  data: DashboardData;
  /** Primera tanda del historial de la **primera** cuenta, resuelta en el server. */
  historialInicial: HistorialPagina | null;
}

export function InicioPanel({ data, historialInicial }: InicioPanelProps) {
  // Solo cuentas reales (las tarjetas sin `id` no tienen historial que mostrar).
  const cuentas = useMemo(
    () => data.cuentas.filter((c) => c.id != null),
    [data.cuentas]
  );
  const [foco, setFoco] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const indice = Math.min(foco, Math.max(0, cuentas.length - 1));
  const cuenta = cuentas[indice];

  /**
   * Índice enfocado a partir del scroll del carrusel. Se calcula en el propio
   * handler (no en un efecto) y solo se llama a `setFoco` cuando **cambia**.
   */
  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.max(
      0,
      Math.min(cuentas.length - 1, Math.round(el.scrollLeft / PASO))
    );
    if (i !== foco) setFoco(i);
  };

  /** Evolución de la cuenta en foco, en el formato que espera `EvolutionChart`. */
  const evolucion = useMemo(
    () =>
      (cuenta?.values ?? []).map((v, i) => ({
        name: cuenta?.labels?.[i] ?? "",
        value: v,
      })),
    [cuenta]
  );

  return (
    <div className="pb-8 pt-4 lg:pt-0">
      {/* Balance: UNA línea (descripción a la izquierda, monto a la derecha). */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <p className="text-[13px] font-medium text-label">Balance Actual</p>
        <p className="text-[17px] font-semibold tracking-tight text-success">
          {numberToCurrency(data.balance, data.monedaPredeterminadaISO)}
        </p>
      </div>

      {cuentas.length === 0 ? (
        <div className="mt-4 flex h-32 items-center justify-center text-[13px] text-subtitle">
          Sin cuentas cargadas
        </div>
      ) : (
        <>
          {/* Carrusel: `scroll-snap` nativo + peek lateral de la siguiente. */}
          <div
            ref={trackRef}
            onScroll={onScroll}
            className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 scroll-pl-4 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {cuentas.map((c, i) => (
              <div key={c.id} className="w-[286px] shrink-0 snap-start">
                <AccountCard
                  {...c}
                  sinSparkline
                  soloSeleccionar
                  className={i === indice ? undefined : "opacity-60"}
                />
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              {cuentas.map((c, i) => (
                <i
                  key={c.id}
                  aria-hidden="true"
                  className={
                    i === indice
                      ? "block h-1.5 w-4.5 rounded-full bg-primary"
                      : "block h-1.5 w-1.5 rounded-full bg-border"
                  }
                />
              ))}
            </span>
            <span className="text-[11px] text-subtitle">
              {indice + 1} de {cuentas.length}
            </span>
          </div>

          {cuenta && (
            <>
              {/* El gráfico que estaba DENTRO de la tarjeta, ahora full-width. */}
              <div className="mt-4">
                <EvolutionChart
                  title={cuenta.title}
                  data={evolucion}
                  area
                  height={150}
                  currency={cuenta.monedaISO}
                />
              </div>

              {/* Historial de la cuenta en foco, con scroll infinito en la misma
                  pantalla. `key` = cuenta ⇒ al deslizar se pide su página 0. */}
              <div className="mt-4">
                <MovimientosCuentaClient
                  key={cuenta.id}
                  embebido
                  cuenta={{
                    id: cuenta.id!,
                    nombre: cuenta.title,
                    saldo: 0,
                    monedaISO: cuenta.monedaISO ?? data.monedaPredeterminadaISO,
                  }}
                  primeraPagina={
                    indice === 0 && historialInicial
                      ? historialInicial
                      : PAGINA_VACIA
                  }
                  monedaPredeterminadaISO={data.monedaPredeterminadaISO}
                />
              </div>
            </>
          )}

          {/* "+" flotante: entra al registro con la cuenta en foco precargada.
              Es la ÚNICA pantalla que lo muestra (decisión del usuario). */}
          <FabNuevo cuentaId={cuenta?.id} />
        </>
      )}
    </div>
  );
}
