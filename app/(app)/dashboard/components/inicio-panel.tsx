"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CuentaSlide } from "./cuenta-slide";
import { ResultadosMensuales } from "./resultados-mensuales";
import { MovimientosCuentaClient } from "@/app/(app)/cuentas/[id]/movimientos-client";
import type { HistorialPagina } from "@/backend/src/queries/movimientos";
import type { DashboardData } from "../dashboard-data";
import { cn, numberToCurrency } from "@/lib/utils";
import { setTopbarScrolled } from "@/lib/topbar-scroll";

/**
 * **Pantalla Inicio** (`/dashboard`) — banda (hero) + carrusel de cuentas
 * (2026-10-02, rama `rediseno-ui`).
 *
 * Rediseño pedido por el usuario a partir de una referencia de app bancaria:
 *
 * 1. **Banda a sangre** (`bg-muted`) que arranca en el borde superior y
 *    **contiene la top bar** ⇒ en el top no hay separación entre la barra y el
 *    resto (la barra se pinta **transparente** desde `components/layout/top-bar.tsx`
 *    y pasa a **translúcida con blur** al scrollear).
 * 2. **Carrusel full-width, 1 cuenta por vista, SIN *peek*** (decisión del
 *    usuario): cada slide trae el bloque completo —nombre + saldo + gráfico +
 *    acciones— y al deslizar cambia todo junto.
 * 3. **Dots** dentro de la banda, abajo de las acciones.
 * 4. Debajo de la banda, el **detalle de la tarjeta en foco**: el historial de la
 *    cuenta (`MovimientosCuentaClient` de `/cuentas/[id]`, con scroll infinito) o,
 *    si el foco es el resumen, los **resultados mensuales** (mismo dato del panel
 *    Resultados, del mes más actual al más antiguo).
 *
 * 🔑 La tarjeta en foco la define **solo el swipe** (se guarda en `sessionStorage`
 *    para volver a la misma cuenta tras remontar). La **primera** tarjeta es el
 *    **resumen (Balance Actual)**, con el gráfico de **evolución de Resultados**
 *    (decisión del usuario 2026-10-02: antes eran barras de aporte por cuenta).
 *
 * ⚠️ **Lazy**: el gráfico se monta solo en el **foco ± 1** (`conGrafico` del slide);
 * el resto reserva el alto con un `Skeleton` hasta acercarse.
 *
 * ⚠️ Se eliminaron los **FAB** de Inicio: las acciones viven **dentro de cada
 * slide** (mismas 3 del FAB "+" en las cuentas y `Gestionar cuentas` en el resumen).
 */
const PAGINA_VACIA: HistorialPagina = { rows: [], total: 0, hayMas: true };

/** Px de scroll a partir de los cuales la top bar se "despega" (translúcida). */
const UMBRAL_TOPBAR_PX = 8;

/**
 * Clave de `sessionStorage` con la **tarjeta en foco** (`"0"` = Balance,
 * 1..N = cuenta): es por pestaña y sobrevive al remontaje de la pantalla ⇒ al
 * volver del wizard el carrusel queda en la MISMA cuenta con la que se entró.
 */
const CLAVE_FOCO = "fp_inicio_foco";

/** Tarjeta guardada (`0` = Balance si no hay nada o si el storage está bloqueado). */
function leerFocoGuardado(): number {
  try {
    const n = Number(sessionStorage.getItem(CLAVE_FOCO));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Guarda la tarjeta en foco (mejor esfuerzo: si falla, no es crítico). */
function guardarFoco(indice: number) {
  try {
    sessionStorage.setItem(CLAVE_FOCO, String(indice));
  } catch {
    /* sin sessionStorage simplemente no se restaura */
  }
}

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
  /** ¿Ya se intentó restaurar la tarjeta guardada? (una sola vez por montaje). */
  const restauradoRef = useRef(false);

  /**
   * Tarjetas del carrusel: la **0 es el Balance Actual** (siempre la primera, la
   * que se ve a la entrada) y de la 1 en adelante las cuentas.
   */
  const totalTarjetas = cuentas.length + 1;
  const indice = Math.min(foco, Math.max(0, totalTarjetas - 1));
  /** Cuenta en foco (`undefined` cuando la tarjeta en foco es la del balance). */
  const cuenta = indice === 0 ? undefined : cuentas[indice - 1];

  /**
   * Ref del track del carrusel: guarda el nodo **y restaura la tarjeta en foco**
   * guardada en `sessionStorage`. Va en un **ref callback** (fase de commit) y no
   * en un efecto: `sessionStorage` no existe en el server (leerlo en el render
   * sería un desajuste de hidratación) y así el `scrollLeft` queda aplicado **antes
   * del primer pintado**.
   */
  const montarTrack = useCallback(
    (node: HTMLDivElement | null) => {
      trackRef.current = node;
      if (!node || restauradoRef.current) return;
      restauradoRef.current = true;
      const i = Math.min(leerFocoGuardado(), totalTarjetas - 1);
      if (i <= 0) return;
      node.scrollLeft = i * node.clientWidth;
      setFoco(i);
    },
    [totalTarjetas]
  );

  /**
   * Índice enfocado a partir del scroll del carrusel. Cada slide ocupa el **100 %
   * del ancho** (sin *peek* y sin gap) ⇒ el paso es `clientWidth`.
   */
  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const paso = el.clientWidth || 1;
    const i = Math.max(
      0,
      Math.min(totalTarjetas - 1, Math.round(el.scrollLeft / paso))
    );
    if (i === foco) return;
    setFoco(i);
    guardarFoco(i);
  };

  /**
   * **Top bar**: marca en el `<html>` si el contenido salió del tope (para que la
   * barra pase de transparente a translúcida — ver `globals.css`). Se escucha el
   * `scroll` del **`<main>` interno** (es quien scrollea; la ventana no) y se llama
   * al setter en cada evento (el toggle de `classList` es idempotente y barato).
   */
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("main");
    if (!root) return;
    const onScroll = () => setTopbarScrolled(root.scrollTop > UMBRAL_TOPBAR_PX);
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      // Al salir de Inicio la barra vuelve a su estado transparente.
      setTopbarScrolled(false);
    };
  }, []);

  return (
    // A sangre: cancela el padding del `<main>` (px-4/lg:px-6 + pt-[--app-top])
    // para que la banda llegue hasta los bordes y hasta arriba de todo.
    <div className="-mx-4 -mt-[var(--app-top)] lg:-mx-6">
      {/* ───────── BANDA (hero) ───────── */}
      <div
        data-inicio-hero=""
        className="relative border-b border-border bg-muted"
        style={{ paddingTop: "var(--app-top)" }}
      >
        {/* Carrusel: full-width, una tarjeta por vista, snap sin peek ni gap. */}
        <div
          ref={montarTrack}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <CuentaSlide
            titulo="Balance Actual"
            monto={numberToCurrency(data.balance, data.monedaPredeterminadaISO)}
            esBalance
            evolucion={data.evolucionResultados}
            monedaISO={data.monedaPredeterminadaISO}
            conGrafico={indice <= 1}
          />
          {cuentas.map((c, i) => {
            const idx = i + 1;
            return (
              <CuentaSlide
                key={c.id}
                titulo={c.title}
                monto={c.value}
                esBalance={false}
                evolucion={(c.values ?? []).map((v, k) => ({
                  name: c.labels?.[k] ?? "",
                  value: v,
                }))}
                monedaISO={c.monedaISO ?? data.monedaPredeterminadaISO}
                cuentaId={c.id ?? undefined}
                conGrafico={Math.abs(idx - indice) <= 1}
              />
            );
          })}
        </div>

        {/* Dots: dentro de la banda, abajo de las acciones. */}
        <div className="mt-2 flex items-center justify-center gap-1.5 pb-2">
          {Array.from({ length: totalTarjetas }).map((_, i) => (
            <i
              key={i}
              aria-hidden="true"
              className={cn(
                "block h-1.5 rounded-full",
                i === indice ? "w-4.5 bg-primary" : "w-1.5 bg-border"
              )}
            />
          ))}
        </div>
      </div>

      {/* ── Debajo de la banda: detalle de la tarjeta en foco ── */}
      <div className="px-4 pt-4 lg:px-6">
        {cuentas.length === 0 && (
          <p className="mb-3 rounded-2xl border border-border bg-card px-4 py-3 text-[13px] text-subtitle">
            No hay cuentas cargadas.
          </p>
        )}
        {indice === 0 ? (
          /* Foco = resumen: los resultados mes a mes, en la grilla de movimientos. */
          <ResultadosMensuales
            data={data.evolucionResultados}
            monedaISO={data.monedaPredeterminadaISO}
          />
        ) : cuenta ? (
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
        ) : null}
      </div>
    </div>
  );
}
