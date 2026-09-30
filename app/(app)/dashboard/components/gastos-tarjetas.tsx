"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { GastoOut } from "@/backend/src/queries/gastos";
import {
  dateTimeToString,
  numberToCurrency,
  todayLocalISODate,
} from "@/lib/utils";
import { useMontado } from "@/lib/use-cliente";

/** Días que muestra el panel: el actual + 2 consecutivos hacia atrás. */
const DIAS_VISIBLES = 3;

/**
 * Pestaña **Detalle** del panel Gastos (2026-09-30).
 *
 * Muestra **una tarjeta por gasto** de los **últimos 3 días** —el actual + 2
 * consecutivos hacia atrás— en **orden cronológico** (el más reciente primero) y
 * **sin separadores de día**: cada tarjeta lleva su **fecha**, su **categoría** y
 * la **cuenta** con la que se pagó, así el listado se entiende sin agrupar.
 * Al pie, el enlace **"Ver más gastos"** → `/gastos` (lista completa, con búsqueda
 * y scroll infinito).
 *
 * Decisiones con el usuario: esta pestaña **no** lleva badge "Mes actual", ni
 * Filtros, ni buscador (la búsqueda vive en la pantalla completa).
 */
export function GastosTarjetas({
  data,
  hoyServidor,
  currency,
}: {
  /** TODOS los gastos del usuario (acá se recorta a la ventana de 3 días). */
  data: GastoOut[];
  /** "Hoy" del servidor: valor de la primera pintada (hidratación segura). */
  hoyServidor: string;
  currency: string;
}) {
  // ⚠️ La ventana depende de "hoy": en el SERVER (UTC) y en el navegador puede
  // caer en días distintos. Igual que los badges "Mes actual", la primera
  // pintada usa la fecha del servidor y, ya montado, la LOCAL del navegador.
  const montado = useMontado();
  const hoy = montado ? todayLocalISODate() : hoyServidor;

  /** Gastos de los últimos `DIAS_VISIBLES` días, del más reciente al más viejo. */
  const gastos = useMemo(() => {
    const desde = diasAntes(hoy, DIAS_VISIBLES - 1);
    return data
      .filter((g) => {
        const f = ymd(g.fechaPago);
        // Los pendientes (sin fechaPago) quedan afuera, igual que en los paneles.
        return !!f && f >= desde && f <= hoy;
      })
      .sort((a, b) => ymd(b.fechaPago).localeCompare(ymd(a.fechaPago)));
  }, [data, hoy]);

  return (
    <div className="space-y-3">
      {gastos.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-subtitle">
          No hay gastos de hoy ni de los 2 días anteriores.
        </p>
      ) : (
        <ul className="space-y-2">
          {gastos.map((g) => (
            <GastoCard key={g.id} gasto={g} currency={currency} />
          ))}
        </ul>
      )}

      {/* Punto de entrada a la lista completa (con búsqueda y scroll infinito). */}
      <Link
        href="/gastos"
        className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-[12.5px] font-medium text-primary transition-colors hover:bg-muted"
      >
        Ver más gastos
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

/**
 * Tarjeta de un gasto del panel.
 *
 *   · Línea 1 → descripción (se recorta con `…` si no entra) | **monto**.
 *   · Línea 2 → **fecha** en un chip (`30-09-26`) + **categoría · cuenta**.
 *
 * El monto vive en su propia columna a la derecha (no se recorta nunca). La fecha
 * va en un chip para que se distinga de la categoría/cuenta de un vistazo.
 */
function GastoCard({ gasto, currency }: { gasto: GastoOut; currency: string }) {
  const fecha = ymd(gasto.fechaPago);
  const categoria = gasto.categoria?.nombre ?? "Sin categoría";
  return (
    <li className="rounded-[10px] border border-border bg-muted px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-[13.5px] font-semibold leading-4.5 text-card-foreground">
            {gasto.descripcion || "Sin descripción"}
          </p>
          <p className="flex items-center gap-1.5 text-[11px] leading-4 text-subtitle">
            <span className="shrink-0 rounded-md border border-border bg-card px-1.5 py-px font-medium tabular-nums text-card-foreground">
              {fecha ? dateTimeToString(fecha) : "sin fecha"}
            </span>
            <span className="truncate">
              {categoria}
              {gasto.cuenta ? ` · ${gasto.cuenta}` : ""}
            </span>
          </p>
        </div>
        <p className="shrink-0 text-[14.5px] font-semibold leading-4.5 tabular-nums text-card-foreground">
          {numberToCurrency(Number(gasto.monto) || 0, currency)}
        </p>
      </div>
    </li>
  );
}

/** "YYYY-MM-DD" de un valor de fecha (Date o string), sin tocar zonas horarias. */
function ymd(v: string | Date | null | undefined): string {
  if (!v) return "";
  return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
}

/** Fecha `n` días antes de `iso` ("YYYY-MM-DD"), con aritmética UTC. */
function diasAntes(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - n);
  return dt.toISOString().slice(0, 10);
}
