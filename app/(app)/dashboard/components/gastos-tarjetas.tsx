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
 * Antes era una **grilla** de 5 columnas (y en mobile obligaba a scroll
 * horizontal). Ahora muestra **tarjetas** de los gastos de los **últimos 3 días**
 * —el actual + 2 consecutivos hacia atrás—, agrupadas por día, y al pie el
 * enlace **"Ver más gastos"** que lleva a la pantalla `/gastos` (lista completa,
 * con búsqueda y scroll infinito).
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

  /** Gastos de los últimos `DIAS_VISIBLES` días, agrupados y ordenados por día. */
  const grupos = useMemo(() => {
    const desde = diasAntes(hoy, DIAS_VISIBLES - 1);
    const porDia = new Map<string, GastoOut[]>();
    for (const g of data) {
      const f = ymd(g.fechaPago);
      // Los pendientes (sin fechaPago) quedan afuera, igual que en los paneles.
      if (!f || f < desde || f > hoy) continue;
      const lista = porDia.get(f);
      if (lista) lista.push(g);
      else porDia.set(f, [g]);
    }
    // Del día más reciente al más viejo (dentro del día se respeta el orden que
    // ya viene: fechaPago DESC).
    return Array.from(porDia.entries()).sort(([a], [b]) => (a < b ? 1 : -1));
  }, [data, hoy]);

  return (
    <div className="space-y-4">
      {grupos.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-subtitle">
          No hay gastos de hoy ni de los 2 días anteriores.
        </p>
      ) : (
        grupos.map(([dia, gastos]) => {
          const totalDia = gastos.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
          return (
            <div key={dia} className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-subtitle">
                  {etiquetaDia(dia, hoy)}
                </p>
                <p className="text-[11px] font-medium tabular-nums text-subtitle">
                  {numberToCurrency(totalDia, currency)}
                </p>
              </div>
              <ul className="space-y-2">
                {gastos.map((g) => (
                  <GastoCard key={g.id} gasto={g} currency={currency} />
                ))}
              </ul>
            </div>
          );
        })
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

/** Tarjeta de un gasto: descripción + importe y, debajo, categoría · cuenta. */function GastoCard({ gasto, currency }: { gasto: GastoOut; currency: string }) {
  return (
    <li className="rounded-[10px] border border-border bg-muted px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-[13.5px] font-semibold leading-4.5 text-card-foreground">
            {gasto.descripcion || "Sin descripción"}
          </p>
          <p className="truncate text-[11px] leading-3.5 text-subtitle">
            {[gasto.categoria?.nombre ?? "Sin categoría", gasto.cuenta]
              .filter(Boolean)
              .join(" · ")}
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

/** Rótulo del grupo: "Hoy" · "Ayer" · la fecha (`dd-mm-aa`). */
function etiquetaDia(iso: string, hoy: string): string {
  if (iso === hoy) return "Hoy";
  if (iso === diasAntes(hoy, 1)) return "Ayer";
  return dateTimeToString(iso);
}
