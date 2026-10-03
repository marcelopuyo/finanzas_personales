"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ItemPendienteOut, LiquidacionOut } from "@/backend/src/queries/trabajos";
import {
  cn,
  dateTimeToString,
  numberToCurrency,
  todayLocalISODate,
} from "@/lib/utils";
import { etiquetaConteoItems, rangoFechas } from "@/lib/trabajo-texto";
import { useMontado } from "@/lib/use-cliente";
import { agruparPendientes } from "../ingresos-pendientes";
import { SparkLineChart } from "./sparkline-chart";
import {
  barrasDeFila,
  esCobrado,
  fechaCobroDe,
  fechaDesdeDe,
  fechaHastaDe,
  itemsDeFila,
  montoDeFila,
  propinaDeFila,
  trabajoDeFila,
  type BarraActividad,
  type FilaDetalleIngresos,
} from "./ingresos-filas";

/** Meses que muestra el panel: el actual + 1 consecutivo hacia atrás. */
const MESES_VISIBLES = 2;

/** Pantalla "Períodos de trabajo" (mismo destino que el panel Trabajo del dashboard). */
const HREF_TRABAJO = "/trabajo";

/**
 * Pestaña **Detalle** del panel Ingresos (2026-09-30, pedido del usuario:
 * "lo mismo que en Gastos").
 *
 * Muestra **una tarjeta por período** los **últimos 2 meses** —el actual + 1
 * consecutivo hacia atrás—, de la más reciente a la más vieja y **sin agrupar
 * por mes**: cada tarjeta lleva su **rango de fechas**, su **trabajo**, el
 * **conteo de ítems**, el estado del cobro y el **sparkline** de sus jornadas/
 * tareas (el mismo gráfico que tenía la grilla vieja). Entran las dos cosas que
 * existen en el circuito (igual que el Detalle de siempre):
 *
 *  · **liquidaciones** (cobradas) → monto en **verde** + "Cobrado dd-mm-aa";
 *  · **grupos pendientes** (jornadas/tareas sin liquidar) → monto en **rojo** +
 *    "Sin cobrar".
 *
 * Al pie, el enlace **"Ver más períodos"** → `/trabajo` (la pantalla completa:
 * pendientes arriba y cobrados con scroll infinito).
 *
 * ⚠️ La ventana es **fija**: no depende de los Filtros del panel (ese es el
 * criterio de Gastos, cuyo Detalle tampoco los lleva). Los Filtros de Ingresos
 * siguen aplicando al Resumen y al Histórico, y al listado completo.
 */
export function IngresosTarjetas({
  liquidaciones,
  itemsPendientes,
  hoyServidor,
  currency,
}: {
  /** TODAS las liquidaciones del usuario (acá se recorta a la ventana). */
  liquidaciones: LiquidacionOut[];
  /** Todos los ítems pendientes de cobro (se agrupan por trabajo). */
  itemsPendientes: ItemPendienteOut[];
  /** "Hoy" del servidor: valor de la primera pintada (hidratación segura). */
  hoyServidor: string;
  currency: string;
}) {
  // ⚠️ La ventana depende de "hoy": en el SERVER (UTC) y en el navegador puede
  // caer en días distintos. Igual que los badges "Mes actual" y las tarjetas de
  // Gastos, la primera pintada usa la fecha del servidor y, ya montado, la LOCAL
  // del navegador.
  const montado = useMontado();
  const hoy = montado ? todayLocalISODate() : hoyServidor;

  /** Filas de los últimos `MESES_VISIBLES` meses, de la más reciente a la más vieja. */
  const filas = useMemo(() => {
    const corte = mesesAntes(hoy, MESES_VISIBLES);
    const cobrados: FilaDetalleIngresos[] = liquidaciones.map((liq) => ({
      tipo: "cobrado",
      liq,
    }));
    const pendientes: FilaDetalleIngresos[] = agruparPendientes(
      itemsPendientes
    ).map((grupo) => ({ tipo: "pendiente", grupo }));
    return [...cobrados, ...pendientes]
      // "Dentro de los últimos 2 meses" por **solapamiento**: un período que
      // empezó antes pero sigue/terminó dentro de la ventana también entra
      // (si no, el período en curso de un `fijo` quedaría afuera).
      .filter((f) => fechaHastaDe(f) >= corte)
      .sort((a, b) => {
        const d = fechaDesdeDe(b).localeCompare(fechaDesdeDe(a));
        return d !== 0 ? d : fechaHastaDe(b).localeCompare(fechaHastaDe(a));
      });
  }, [liquidaciones, itemsPendientes, hoy]);

  return (
    <div className="space-y-3">
      {filas.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-subtitle">
          No hay períodos en los últimos 2 meses.
        </p>
      ) : (
        <ul className="space-y-2">
          {filas.map((fila) => (
            <PeriodoCard
              key={esCobrado(fila) ? `liq:${fila.liq.id}` : fila.grupo.key}
              fila={fila}
              currency={currency}
            />
          ))}
        </ul>
      )}

      {/* Punto de entrada a la pantalla completa de períodos de trabajo. */}
      <Link
        href={HREF_TRABAJO}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-[12.5px] font-medium text-primary transition-colors hover:bg-muted"
      >
        Ver más períodos
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

/**
 * Tarjeta de un período del Detalle de Ingresos.
 *
 *   · Línea 1 → **trabajo** (se recorta con `…` si no entra) | **monto**.
 *   · Línea 2 → **rango de fechas** en un chip (`28-09 → 30-09`) +
 *     **conteo de ítems · estado del cobro** (`3 jornadas · Cobrado 30-09-26`).
 *   · Línea 3 → **sparkline** de las jornadas (con su propina) / tareas del
 *     período: una barra por ítem, con el tooltip de fecha + monto (es el mismo
 *     gráfico que tenía la columna "Jornadas/Tareas" de la grilla vieja).
 *
 * La línea 2 usa **todo el ancho** de la tarjeta (el monto no se lo come) y el
 * rango va en el formato corto del circuito de Trabajo (`rangoFechas`, el mismo
 * de la pantalla `/trabajo`): así el chip + el estado entran incluso a 320 px.
 *
 * El monto vive en su propia columna a la derecha (no se recorta nunca), en la
 * **píldora** que ya usa la grilla —verde = cobrado · rojo = sin cobrar— y con la
 * **propina** debajo, en verde, cuando existe (la propina es devengo de la jornada
 * y no integra el monto del período).
 */
function PeriodoCard({
  fila,
  currency,
}: {
  fila: FilaDetalleIngresos;
  currency: string;
}) {
  const rango = rangoFechas(fechaDesdeDe(fila), fechaHastaDe(fila));

  const trabajo = trabajoDeFila(fila) || "Sin trabajo";
  const { jornadas, tareas } = itemsDeFila(fila);
  const conteo = etiquetaConteoItems(jornadas, tareas);

  const fechaCobro = fechaCobroDe(fila);
  const propina = propinaDeFila(fila);
  const barras = barrasDeFila(fila);

  return (
    <li className="rounded-[10px] border border-border bg-muted px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        <p className="min-w-0 flex-1 truncate text-[13.5px] leading-4.5 text-card-foreground">
          {trabajo}
        </p>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[12px] tabular-nums",
              fechaCobro
                ? "bg-success/10 text-success"
                : "bg-danger/10 text-danger"
            )}
          >
            {numberToCurrency(montoDeFila(fila), currency)}
          </span>
          {propina > 0.005 && (
            <span className="text-[10px] font-medium tabular-nums text-success">
              propina {numberToCurrency(propina, currency)}
            </span>
          )}
        </div>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-[11px] leading-4 text-subtitle">
        <span className="shrink-0 rounded-md border border-border bg-card px-1.5 py-px font-medium tabular-nums text-card-foreground">
          {rango || "sin fecha"}
        </span>
        <span className="min-w-0 flex-1 truncate">
          {conteo && `${conteo} · `}
          {fechaCobro ? (
            `Cobrado ${dateTimeToString(fechaCobro)}`
          ) : (
            <span className="font-medium text-danger">Sin cobrar</span>
          )}
        </span>
      </p>
      <SparkActividad barras={barras} currency={currency} />
    </li>
  );
}

/**
 * Sparkline de la tarjeta: el `SparkLineChart` en variante **barras** —una por
 * ítem, con el tooltip de fecha + monto—, con el **ancho acotado según la
 * cantidad de barras**: el chart estira (`preserveAspectRatio="none"` + `w-full`),
 * así que sin tope una fila de 2 ítems quedaría con barras enormes. Sin ítems no
 * se renderiza nada.
 */
function SparkActividad({
  barras,
  currency,
}: {
  barras: BarraActividad[];
  currency: string;
}) {
  if (barras.length === 0) return null;
  const ancho = Math.min(240, Math.max(56, barras.length * 18));
  return (
    <div style={{ width: ancho }} className="max-w-full pt-0.5">
      <SparkLineChart
        variant="bar"
        data={barras.map((b) => b.monto)}
        labels={barras.map((b) => b.label)}
        currency={currency}
      />
    </div>
  );
}

/**
 * Fecha `n` **meses** antes de `iso` ("YYYY-MM-DD"), con aritmética UTC y el día
 * recortado al último del mes destino (31-05 − 3 meses → 28/29-02).
 */
function mesesAntes(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const destino = new Date(Date.UTC(y, m - 1 - n, 1));
  const anio = destino.getUTCFullYear();
  const mes = destino.getUTCMonth();
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return `${anio}-${String(mes + 1).padStart(2, "0")}-${String(
    Math.min(d, ultimoDia)
  ).padStart(2, "0")}`;
}
