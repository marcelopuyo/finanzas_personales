"use client";

import { useMemo, useRef, useState } from "react";
import { numberToCurrency } from "@/lib/utils";
import { AccountCard } from "./account-card";
import { BalanceCard } from "./balance-card";
import { BalanceBarrasChart } from "./balance-barras-chart";
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
 *
 * 📌 **2026-10-02 — el Balance pasó a ser la PRIMERA tarjeta del carrusel** (antes
 * era una franja suelta de una línea arriba): es siempre la tarjeta de entrada, con
 * el mismo lenguaje visual que las de cuenta pero con tratamiento propio
 * (`BalanceCard`). Debajo del carrusel, **cuando el foco es la tarjeta de balance**,
 * se pinta un **gráfico de barras** con una barra por cuenta que suma al balance
 * (`BalanceBarrasChart`) en lugar de la evolución de una cuenta. Índices del
 * carrusel: **0 = Balance**, 1..N = cuentas.
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

  /**
   * Tarjetas del carrusel: la **0 es el Balance Actual** (siempre la primera, la
   * que se ve a la entrada) y de la 1 en adelante las cuentas.
   */
  const totalTarjetas = cuentas.length + 1;
  const indice = Math.min(foco, Math.max(0, totalTarjetas - 1));
  /** Cuenta en foco (`undefined` cuando la tarjeta en foco es la del balance). */
  const cuenta = indice === 0 ? undefined : cuentas[indice - 1];

  /**
   * Índice enfocado a partir del scroll del carrusel. Se calcula en el propio
   * handler (no en un efecto) y solo se llama a `setFoco` cuando **cambia**.
   */
  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.max(
      0,
      Math.min(totalTarjetas - 1, Math.round(el.scrollLeft / PASO))
    );
    if (i !== foco) setFoco(i);
  };

  /**
   * Barras del balance: una por **cuenta que suma al Balance Actual**
   * (`aportaAlBalance` = switch "Incluir en el balance actual" del CRUD), en el
   * **orden del carrusel** y con el saldo **convertido a la moneda predeterminada**
   * (lo resuelve el backend en `getCuentasConEvolucion`), para que las cuentas en
   * monedas distintas sean comparables entre sí.
   */
  const barrasBalance = useMemo(
    () =>
      cuentas
        .filter((c) => c.aportaAlBalance)
        .map((c) => ({ name: c.title, value: c.saldoPredeterminado })),
    [cuentas]
  );

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
      {/* Carrusel: `scroll-snap` nativo + peek lateral de la siguiente.
          La PRIMERA tarjeta es el **Balance Actual** (la de entrada) y después
          vienen las cuentas en su orden configurado. */}
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 scroll-pl-4 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="w-[286px] shrink-0 snap-start">
          <BalanceCard
            balance={numberToCurrency(
              data.balance,
              data.monedaPredeterminadaISO
            )}
            className={indice === 0 ? undefined : "opacity-60"}
          />
        </div>
        {cuentas.map((c, i) => (
          <div key={c.id} className="w-[286px] shrink-0 snap-start">
            <AccountCard
              {...c}
              sinSparkline
              soloSeleccionar
              className={i + 1 === indice ? undefined : "opacity-60"}
            />
          </div>
        ))}
      </div>

      {/* Puntos del carrusel: **centrados** y **sin contador "m de n"**
          (2026-10-02, pedido del usuario: la posición se lee por el punto
          ancho, el recuento era ruido). */}
      <div className="mt-3 flex items-center justify-center gap-1.5">
        {Array.from({ length: totalTarjetas }).map((_, i) => (
          <i
            key={i}
            aria-hidden="true"
            className={
              i === indice
                ? "block h-1.5 w-4.5 rounded-full bg-primary"
                : "block h-1.5 w-1.5 rounded-full bg-border"
            }
          />
        ))}
      </div>

      {cuentas.length === 0 && (
        <p className="mt-4 rounded-2xl border border-border bg-card px-4 py-3 text-[13px] text-subtitle">
          No hay cuentas cargadas.
        </p>
      )}

      {/* Gráfico de la tarjeta en foco: con la del **Balance** (índice 0) es un
          gráfico de BARRAS con una barra por cuenta que suma al balance; con una
          cuenta es su evolución. En los dos casos va **sin el nombre dentro del
          panel** (`encabezado={null}`). */}
      <div className="mt-4">
        {indice === 0 ? (
          <BalanceBarrasChart
            data={barrasBalance}
            currency={data.monedaPredeterminadaISO}
          />
        ) : (
          <EvolutionChart
            data={evolucion}
            area
            height={150}
            currency={cuenta?.monedaISO}
            encabezado={null}
          />
        )}
      </div>

      {/* Historial de la cuenta en foco, con scroll infinito en la misma pantalla.
          `key` = cuenta ⇒ al deslizar se pide su página 0. Con la tarjeta de
          Balance en foco no se pinta: el balance no es una cuenta. */}
      {cuenta && (
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
              indice === 1 && historialInicial ? historialInicial : PAGINA_VACIA
            }
            monedaPredeterminadaISO={data.monedaPredeterminadaISO}
          />
        </div>
      )}

      {/* "+" flotante: entra al registro con la cuenta en foco precargada.
          Es la ÚNICA pantalla que lo muestra (decisión del usuario). */}
      <FabNuevo cuentaId={cuenta?.id} />
    </div>
  );
}
