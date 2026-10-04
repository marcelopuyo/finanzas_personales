"use client";

import { Settings2 } from "lucide-react";
import { AccionCirculo } from "./accion-circulo";
import { AporteDonut } from "./aporte-donut";
import { EvolutionChart } from "./line-chart";
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
  /** **Donut de aporte por cuenta** (solo la tarjeta de *Balance Actual*): si
      viene, el área del gráfico muestra la dona en vez de la línea. */
  donut?: AporteCuenta[];
  /** ISO 4217 (formatea el tooltip del gráfico). */
  monedaISO: string;
  /** Cuenta a precargar en el wizard (solo cuentas). */
  cuentaId?: number;
  /** ¿Montar el gráfico? (`true` solo en el foco ± 1). */
  conGrafico: boolean;
}

export function CuentaSlide({
  titulo,
  monto,
  esBalance,
  evolucion,
  donut,
  monedaISO,
  cuentaId,
  conGrafico,
}: CuentaSlideProps) {
  const prefetch = usePrefetchNav();
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
          ⚠️ El resumen muestra la **dona de aporte por cuenta** (decisión del
          usuario 2026-10-03; antes era la evolución de Resultados); las cuentas,
          su propia evolución.
          📏 Alto **fijo en px** (no `%` ni `vh`): con `min(128px,16vh)` el 2026-10-03
          el gráfico no se pintó en el celular y la banda quedaba en más de media
          pantalla. 96px deja la banda cómoda y la serie se lee bien. */}
      <div className="mt-3">
        {!conGrafico ? (
          // ⚠️ El fondo de la banda es `bg-muted` y el skeleton por defecto también
          // ⇒ quedaba **invisible** y el hueco se leía como "gráfico roto". Con
          // `bg-card/40` se ve como un bloque en carga.
          <Skeleton className="h-24 rounded-xl bg-card/40" />
        ) : donut ? (
          // Tarjeta de **Balance Actual**: la dona de aporte por cuenta.
          <AporteDonut data={donut} currency={monedaISO} height={96} />
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
