"use client";

import { useEffect, useRef } from "react";
import { Settings2 } from "lucide-react";
import { AccionCirculo } from "./accion-circulo";
import { AporteBarra } from "./aporte-barra";
import { EvolutionChart } from "./line-chart";
import { useFlickLateral } from "./use-flick-lateral";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrefetchNav } from "@/components/ui/nav-progress";
import type { AporteCuenta } from "../aportes-balance";
import {
  HREF_CUENTAS,
  accionesNuevoMovimiento,
} from "@/components/movimientos/fab-nuevo";

/**
 * **Slide del carrusel de Inicio** (2026-10-02, rama `rediseno-ui`).
 *
 * La banda superior de Inicio es un **carrusel full-width, 1 tarjeta por vista,
 * sin *peek*** (decisión del usuario): cada slide es el **bloque completo de una
 * cuenta** —nombre + saldo + **su gráfico** + **sus acciones**—, así al deslizar
 * cambia *todo junto* y se acaba el "salto" del gráfico que había cuando el
 * gráfico vivía fuera del carrusel.
 *
 * 🔑 **Sin recuadro**: el slide **no** es una tarjeta (nada de borde ni fondo
 * propio) — el fondo lo pone la **banda** (`bg-muted`, ver `inicio-panel.tsx`), y
 * el nombre + el saldo van **centrados**, estilo *hero*.
 *
 * Acciones: **las mismas que tenía el FAB** (`accionesNuevoMovimiento`, fuente
 * única) — 3 en las cuentas (**Gasto · Transferencia · Ajuste de cuenta**, con la
 * cuenta de ESE slide precargada en el wizard) y **1** en el resumen
 * (**Cuentas** → `/cruds/cuentas?origen=dashboard`). Son círculos
 * **semitransparentes** y más chicos que el FAB, como pidió el usuario.
 *
 * ⚠️ El gráfico **no** se monta siempre: el carrusel lo monta al acercarse el foco
 * y lo **deja montado** (`conGrafico`; una vez montado no se desmonta). Mientras
 * no corresponde, se reserva el alto con un `Skeleton`.
 */
interface CuentaSlideProps {
  /** Nombre de la cuenta o `"Balance Actual"`. */
  titulo: string;
  /** Saldo **ya formateado** (con su moneda). */
  monto: string;
  /** `true` = tarjeta de **resumen** (el Balance), la primera del carrusel. */
  esBalance: boolean;
  /** Serie del gráfico de línea: la evolución de la cuenta. No se usa si viene
      `donut` (la tarjeta de *Balance Actual* pinta la dona de aportes). */
  evolucion?: { name: string; value: number }[];
  /** **Aporte por cuenta** (solo la tarjeta de *Balance Actual*): si viene, el
      área del gráfico muestra la **barra apilada** en vez de la línea. */
  aporte?: AporteCuenta[];
  /** ISO 4217 (formatea el tooltip del gráfico). */
  monedaISO: string;
  /** Cuenta a precargar en el wizard (solo cuentas). */
  cuentaId?: number;
  /** ¿Montar el gráfico? (`true` solo en el foco ± 1). */
  conGrafico: boolean;
  /**
   * **Flick lateral sobre la franja del gráfico** (2026-10-05): el gráfico toma el
   * gesto lateral para scrubear el tooltip (`touch-action: pan-y`), así que un
   * deslizamiento **rápido** se le avisa acá para que el carrusel pase de tarjeta,
   * como al deslizar en el resto del encabezado. `1` = siguiente, `-1` = anterior.
   * Ver `use-flick-lateral.ts`.
   */
  alFlick?: (dir: 1 | -1) => void;
  /**
   * La **banda entera** está silenciada: ningún gráfico de la banda monta su
   * tooltip. Ver `inicio-panel.tsx`, que es quien la comanda.
   */
  silenciada?: boolean;
  /**
   * Avisa al carrusel que hay que **silenciar la banda entera**. Lo dispara
   * `useFlickLateral` apenas el gesto viene rápido (`alRapido`), al confirmarse el
   * flick (`alFlick`) y **siempre al soltar** (`alSoltar`, sea flick o un arrastre
   * lento): sin eso, los `mouse*` **emulados** de iOS volvían a encender el tooltip
   * y quedaba pegado hasta el toque siguiente. El **toque siguiente** despierta la
   * banda (ver `inicio-panel.tsx`).
   *
   * 🔑 **Por qué la banda y no solo esta tarjeta** (2026-10-05): al hacer flick el
   * carrusel queda en **otra** tarjeta, y esos `mouseover`/`mousemove` **emulados**
   * caen **ahí** ⇒ el tooltip aparecía en la tarjeta nueva, que nadie había
   * silenciado.
   */
  alSilenciar?: () => void;
}

export function CuentaSlide({
  titulo,
  monto,
  esBalance,
  evolucion,
  aporte,
  monedaISO,
  cuentaId,
  conGrafico,
  alFlick,
  silenciada = false,
  alSilenciar,
}: CuentaSlideProps) {
  const prefetch = usePrefetchNav();
  /** Franja del gráfico: sirve para apagar su tooltip al hacer un flick. */
  const franjaRef = useRef<HTMLDivElement | null>(null);
  /** Timers de apagado del gráfico (se limpian al desmontar). */
  const timersRef = useRef<number[]>([]);

  useEffect(
    () => () => {
      for (const t of timersRef.current) window.clearTimeout(t);
    },
    []
  );

  /**
   * Apaga el tooltip del gráfico. Es el mismo truco que usa
   * `useHideTooltipOnTouch`: Recharts limpia su estado de interacción con el
   * `mouseout` del `.recharts-wrapper` (sirve para que también se vaya el punto
   * activo de la serie).
   */
  const apagarTooltips = () => {
    const raiz = franjaRef.current;
    if (!raiz) return;
    for (const wrapper of raiz.querySelectorAll(".recharts-wrapper")) {
      wrapper.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    }
  };

  /**
   * Flick sobre la franja: se silencia la banda entera (ya se hizo apenas el gesto
   * se puso rápido, se repite acá por las dudas) y se vuelve a apagar el punto
   * activo a los 200 y 550 ms, mientras la tarjeta se desliza.
   */
  const alFlickDeLaFranja = (dir: 1 | -1) => {
    alSilenciar?.();
    apagarTooltips();
    timersRef.current.push(
      window.setTimeout(apagarTooltips, 200),
      window.setTimeout(apagarTooltips, 550)
    );
    alFlick?.(dir);
  };

  const flick = useFlickLateral({
    alFlick: alFlickDeLaFranja,
    alRapido: alSilenciar,
    alSoltar: alSilenciar,
  });
  /**
   * Los gestos de flick se enganchan **sólo en la franja del gráfico**, que es
   * donde el gesto lateral está tomado (`pan-y`). En la barra de aporte de la
   * tarjeta de resumen el swipe nativo ya mueve el carrusel: engancharlos ahí
   * pasaría de tarjeta dos veces.
   */
  const gestosFlick =
    alFlick && conGrafico && !aporte
      ? {
          onTouchStart: flick.onTouchStart,
          onTouchMove: flick.onTouchMove,
          onTouchEnd: flick.onTouchEnd,
          onTouchCancel: flick.onTouchCancel,
        }
      : undefined;
  // El resumen no ofrece el registro (no hay cuenta que precargar): su acción es
  // gestionar las cuentas que lo componen.
  const acciones = esBalance ? [] : accionesNuevoMovimiento(cuentaId);

  return (
    <section className="w-full shrink-0 snap-start px-4 lg:px-6">
      {/* Rótulo: **solo el nombre** (sin icono), centrado y en el **mismo color que
          las demás tarjetas** (`text-value`), incluso en la del resumen (pedido del
          usuario). El color distintivo del resumen queda solo en su **monto**. */}
      <p className="text-center text-[12.5px] text-value">{titulo}</p>
      {/* El monto va **siempre en blanco**, igual que en las demás tarjetas (el
          resumen ya no se distingue por color: solo por su gráfico de barras y por
          tener una única acción). */}
      <p className="mt-0.5 text-center text-[28px] leading-8 tracking-tight text-value">
        {monto}
      </p>

      {/* Gráfico: más abajo del saldo (pedido del usuario) y en modo **mínimo**
          — solo la serie, sin rótulos de ejes ni líneas horizontales.
          ⚠️ El resumen muestra la **barra de aporte por cuenta** (decisión del
          usuario 2026-10-03, diseño C; antes era la evolución de Resultados y,
          por un rato, una dona); las cuentas, su propia evolución.
          📏 Alto **fijo en px** (no `%` ni `vh`): con `min(128px,16vh)` el 2026-10-03
          el gráfico no se pintó en el celular y la banda quedaba en más de media
          pantalla. 96px deja la banda cómoda y la serie se lee bien. */}
      <div className="mt-3" ref={franjaRef} {...gestosFlick}>
        {!conGrafico ? (
          // ⚠️ El fondo de la banda es `bg-muted` y el skeleton por defecto también
          // ⇒ quedaba **invisible** y el hueco se leía como "gráfico roto". Con
          // `bg-card/40` se ve como un bloque en carga.
          <Skeleton className="h-24 rounded-xl bg-card/40" />
        ) : aporte ? (
          // Tarjeta de **Balance Actual**: la barra de aporte por cuenta.
          <AporteBarra data={aporte} height={96} />
        ) : (
          <EvolutionChart
            data={evolucion ?? []}
            color="var(--success)"
            area
            height={96}
            currency={monedaISO}
            encabezado={null}
            sinRecuadro
            minimo
            sinScrollLateral
            sinTooltip={silenciada}
          />
        )}
      </div>

      {/* Acciones (las del FAB + la del resumen), abajo del gráfico y DENTRO del
          carrusel: al deslizar viajan con la cuenta. El botón es el
          **compartido** `AccionCirculo` (mismo estilo que las acciones del panel
          de Ingresos). */}
      <div className="mt-1.5 flex justify-center gap-1">
        {esBalance ? (
          <AccionCirculo href={HREF_CUENTAS} icon={Settings2} label="Cuentas" />
        ) : (
          acciones.map((a) => (
            <AccionCirculo
              key={a.label}
              href={a.href}
              icon={a.icon}
              label={a.label}
              onPrefetch={() => prefetch(a.href)}
            />
          ))
        )}
      </div>
    </section>
  );
}
