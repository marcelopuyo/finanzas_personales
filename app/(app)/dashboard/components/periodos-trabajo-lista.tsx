"use client";

import { CalendarClock } from "lucide-react";
import type { BloqueCobro, EstimacionTrabajo } from "@/lib/cobros-estimados";
import { cn, numberToCurrency } from "@/lib/utils";

/** "dd/mm" de una fecha "YYYY-MM-DD" (se corta el string: nunca se parsea, así
 *  no hay corrimiento de día por zona horaria). */
function corta(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

/** Rango del bloque: "20/09", "24/09 → 26/09" o con el año si el rango lo cruza. */
function rangoFechas(desde: string, hasta: string): string {
  if (!desde) return "";
  if (desde === hasta) return corta(desde);
  const anioDesde = desde.slice(0, 4);
  const anioHasta = hasta.slice(0, 4);
  return anioDesde === anioHasta
    ? `${corta(desde)} → ${corta(hasta)}`
    : `${corta(desde)}/${anioDesde} → ${corta(hasta)}/${anioHasta}`;
}

/** "3 jornadas", "1 tarea" o "1 jornada y 2 tareas" (un bloque puede mezclar). */
function conteo(b: BloqueCobro): string {
  const partes: string[] = [];
  if (b.jornadas)
    partes.push(`${b.jornadas} ${b.jornadas === 1 ? "jornada" : "jornadas"}`);
  if (b.tareas) partes.push(`${b.tareas} ${b.tareas === 1 ? "tarea" : "tareas"}`);
  return partes.join(" y ");
}

type SeccionId = "porCobrar" | "enCurso" | "sinPeriodo";

/** Las 3 secciones del panel, en orden, con su color.
 *  🔑 **El color del MONTO dice si se puede cobrar**: verde = período cerrado
 *  (cobrable) · ámbar = todavía no (período en curso/futuro) · blanco = sin
 *  período estimado (no se pudo inferir la cadencia). */
const SECCIONES: {
  id: SeccionId;
  etiqueta: string;
  /** Clases del chip del encabezado de la sección. */
  chip: string;
  /** Clases del monto (encabezado y fichas). */
  monto: string;
}[] = [
  {
    id: "porCobrar",
    etiqueta: "Por cobrar",
    chip: "border-success/45 bg-success/10 text-success",
    monto: "text-success",
  },
  {
    id: "enCurso",
    etiqueta: "En curso",
    chip: "border-warning/45 bg-warning/10 text-warning",
    monto: "text-warning",
  },
  {
    id: "sinPeriodo",
    etiqueta: "Sin período estimado",
    chip: "border-border bg-muted text-subtitle",
    monto: "text-card-foreground",
  },
];

/**
 * Panel "Trabajo" del dashboard: **ítems PENDIENTES de cobro** (jornadas y
 * tareas sin liquidar) repartidos en las **tandas estimadas** de cada trabajo
 * (decisión del usuario 2026-09-27, opción C de
 * `favicons/preview-panel-trabajo-split.html`).
 *
 * - **Por cobrar**: los ítems cuya ventana estimada **ya cerró** ⇒ se pueden
 *   cobrar ahora.
 * - **En curso**: los de la ventana **en curso o futura** ⇒ todavía no.
 * - **Sin período estimado**: trabajos con cadencia no inferible (los legacy de
 *   1 día, `por_tarea` sin historial) e ítems fuera de toda ventana.
 *
 * La inferencia vive en `lib/cobros-estimados.ts` (módulo **puro**, testeable) y
 * se calcula en el **server** (`dashboard-data.ts`) para que el SSR y el cliente
 * rendericen exactamente lo mismo (nada que recalcular ⇒ sin desajuste de
 * hidratación; ver §191 de la bitácora).
 *
 * El desglose ítem por ítem (y su edición) vive en la **grilla de `/trabajo`**;
 * acá sólo se resume. Las filas no son clickeables: el panel entero navega.
 */
export function PeriodosTrabajoLista({
  estimaciones,
  currency,
}: {
  estimaciones: EstimacionTrabajo[];
  /** ISO 4217 de la moneda predeterminada del usuario. */
  currency: string;
}) {
  if (estimaciones.length === 0) {
    return (
      <p className="py-3 text-[13px] text-subtitle">
        No hay jornadas ni tareas pendientes de cobro.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {SECCIONES.map((sec) => {
        const bloques = estimaciones
          .map((e) => e[sec.id])
          .filter((b): b is BloqueCobro => b !== null);
        if (bloques.length === 0) return null;
        const monto = bloques.reduce((acc, b) => acc + b.monto, 0);
        const nItems = bloques.reduce((acc, b) => acc + b.jornadas + b.tareas, 0);
        return (
          <section key={sec.id}>
            {/* Encabezado de la sección: chip + cantidad de ítems + subtotal. */}
            <div className="flex items-center gap-1.5 pb-1.5">
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-px text-[9px] font-semibold tracking-wide uppercase",
                  sec.chip
                )}
              >
                {sec.id === "porCobrar" && (
                  <CalendarClock className="h-2.5 w-2.5" />
                )}
                {sec.etiqueta}
              </span>
              <span className="text-[12.5px] text-subtitle">· {nItems}</span>
              <span
                className={cn(
                  "ml-auto text-[13.5px] font-semibold tabular-nums",
                  sec.monto
                )}
              >
                {numberToCurrency(monto, currency)}
              </span>
            </div>

            {/* Una ficha por trabajo, siempre en 1 columna (mobile-first): el
                ancho disponible alcanza a 320 px y no hay scroll horizontal. */}
            <div className="flex flex-col gap-2 pt-1">
              {bloques.map((b) => {
                const estado = b.cierre
                  ? sec.id === "porCobrar"
                    ? `venció el ${corta(b.cierre)}`
                    : `cierra el ${corta(b.cierre)}`
                  : "";
                return (
                  <div
                    key={`${sec.id}-${b.trabajo}`}
                    className="rounded-[10px] border border-border bg-muted px-3 py-2.5"
                  >
                    {/* Línea 1: trabajo + monto (del color de la sección). */}
                    <div className="flex items-baseline gap-2.5">
                      <p className="min-w-0 flex-1 text-[13.5px] font-semibold break-words text-header">
                        {b.trabajo}
                      </p>
                      <span
                        className={cn(
                          "shrink-0 text-[14.5px] font-semibold tabular-nums",
                          sec.monto
                        )}
                      >
                        {numberToCurrency(b.monto, currency)}
                      </span>
                    </div>
                    {/* Línea 2: cantidad + rango + estado del período estimado. */}
                    <p className="mt-0.5 flex items-baseline gap-2 text-[11px] leading-[15px] text-subtitle">
                      <span className="min-w-0">
                        {conteo(b)} · {rangoFechas(b.desde, b.hasta)}
                        {estado ? ` · ${estado}` : ""}
                      </span>
                      {b.propina > 0 && (
                        <span className={cn("ml-auto shrink-0", sec.monto)}>
                          propina {numberToCurrency(b.propina, currency)}
                        </span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

