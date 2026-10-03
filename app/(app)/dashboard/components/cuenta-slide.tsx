"use client";

import Link from "next/link";
import { Settings2, type LucideIcon } from "lucide-react";
import { EvolutionChart } from "./line-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { LinkNavStatus, usePrefetchNav } from "@/components/ui/nav-progress";
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
 * ⚠️ El gráfico **no** se monta siempre: el carrusel lo monta solo en el **foco ± 1**
 * (`conGrafico`), para no tener N Recharts vivos. Cuando no corresponde, se reserva
 * el alto con un `Skeleton`.
 */
interface CuentaSlideProps {
  /** Nombre de la cuenta o `"Balance Actual"`. */
  titulo: string;
  /** Saldo **ya formateado** (con su moneda). */
  monto: string;
  /** `true` = tarjeta de **resumen** (el Balance), la primera del carrusel. */
  esBalance: boolean;
  /** Serie del gráfico: la evolución de la cuenta o, en el resumen, la de
      **Resultados** (ingresos − gastos por mes, la misma del panel Resultados). */
  evolucion: { name: string; value: number }[];
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
      <p className="pt-1 text-center text-[12.5px] text-value">{titulo}</p>
      {/* El monto va **siempre en blanco**, igual que en las demás tarjetas (el
          resumen ya no se distingue por color: solo por su gráfico de barras y por
          tener una única acción). */}
      <p className="mt-0.5 text-center text-[30px] leading-9 tracking-tight text-value">
        {monto}
      </p>

      {/* Gráfico: más abajo del saldo (pedido del usuario) y en modo **mínimo**
          — solo la serie, sin rótulos de ejes ni líneas horizontales.
          ⚠️ El resumen muestra la **evolución de Resultados** (decisión del
          usuario 2026-10-02); las cuentas, su propia evolución. */}
      <div className="mt-6">
        {!conGrafico ? (
          <Skeleton className="h-37.5 rounded-xl" />
        ) : (
          <EvolutionChart
            data={evolucion}
            color="var(--success)"
            area
            height={150}
            currency={monedaISO}
            encabezado={null}
            sinRecuadro
            minimo
          />
        )}
      </div>

      {/* Acciones (las del FAB + la del resumen), abajo del gráfico y DENTRO del
          carrusel: al deslizar viajan con la cuenta. */}
      <div className="mt-2 flex justify-center gap-1">
        {esBalance ? (
          <AccionSlide href={HREF_CUENTAS} icon={Settings2} label="Cuentas" />
        ) : (
          acciones.map((a) => (
            <AccionSlide
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

/**
 * Botón de acción del slide: **círculo semitransparente** (más chico que el FAB)
 * con el ícono y, debajo, el rótulo. Es un `<Link>` —es navegación y en mobile
 * conviene el `<a href>` nativo (lección §117/§118)— con la barra de progreso
 * global de feedback.
 */
function AccionSlide({
  href,
  icon: Icon,
  label,
  onPrefetch,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  onPrefetch?: () => void;
}) {
  return (
    <Link
      href={href}
      onPointerEnter={onPrefetch}
      onTouchStartCapture={onPrefetch}
      className="flex w-[92px] flex-col items-center gap-1.5 rounded-xl px-1 py-1.5"
    >
      <span className="flex h-9.5 w-9.5 items-center justify-center rounded-full border border-border bg-card/60 text-value">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span className="text-center text-[9.5px] leading-[1.15] text-card-foreground">
        {label}
      </span>
      <LinkNavStatus />
    </Link>
  );
}
