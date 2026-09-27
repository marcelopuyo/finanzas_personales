"use client";

import { CalendarClock } from "lucide-react";
import type { ItemPendienteOut } from "@/backend/src/queries/trabajos";
import { numberToCurrency } from "@/lib/utils";

const SIN_TRABAJO = "Sin trabajo";

/** "dd/mm" de una fecha "YYYY-MM-DD" (se corta el string: nunca se parsea, así
 *  no hay corrimiento de día por zona horaria). */
function corta(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

/** Rango del grupo: "20/09", "24/09 → 26/09" o con el año si el rango lo cruza. */
function rangoFechas(fechas: string[]): string {
  const ordenadas = [...fechas].sort();
  const desde = ordenadas[0];
  const hasta = ordenadas[ordenadas.length - 1];
  if (desde === hasta) return corta(desde);
  const anioDesde = desde.slice(0, 4);
  const anioHasta = hasta.slice(0, 4);
  return anioDesde === anioHasta
    ? `${corta(desde)} → ${corta(hasta)}`
    : `${corta(desde)}/${anioDesde} → ${corta(hasta)}/${anioHasta}`;
}

/** "3 jornadas", "1 tarea" o "1 jornada y 2 tareas" (un grupo puede mezclar). */
function conteo(lista: ItemPendienteOut[]): string {
  const jornadas = lista.filter((i) => i.tipo === "jornada").length;
  const tareas = lista.length - jornadas;
  const partes: string[] = [];
  if (jornadas)
    partes.push(`${jornadas} ${jornadas === 1 ? "jornada" : "jornadas"}`);
  if (tareas) partes.push(`${tareas} ${tareas === 1 ? "tarea" : "tareas"}`);
  return partes.join(" y ");
}

/**
 * Panel "Trabajo" del dashboard: **ítems PENDIENTES de cobro** (jornadas y
 * tareas que todavía no tienen liquidación), **agrupados por trabajo** con el
 * total de cada grupo y el total general (decisión P1.b de
 * `DeepSeek/plan-liquidaciones.md`).
 *
 * - Los grupos salen de `trabajoId` (columna propia del ítem desde R2), así que
 *   un ítem huérfano de trabajo cae en "Sin trabajo" y no se pierde de vista.
 * - "Actuales"/"En curso" **ya no existen**: un período en curso no es un dato
 *   (la liquidación nace al cobrar) y `fijo`/`horas_fijas` no generan ítems, así
 *   que no aparece nada que cobrar para esas modalidades.
 * - **Sólo el agregado por trabajo** (decisión del usuario 2026-09-26, opción C
 *   de `favicons/preview-panel-trabajo.html`): cada trabajo es una **ficha de 2
 *   líneas** — nombre + subtotal arriba, cantidad de ítems + rango de fechas (+
 *   propina) abajo. El desglose de ítems (y su edición) vive en la **grilla de
 *   `/trabajo`** (`components/periodos-grid.tsx`), no acá: el panel sólo resume.
 * - **Los montos van en verde**: es plata **sin cobrar** (los cobrados usan
 *   blanco; el verde/blanco es el único diferenciador estético, 2026-09-26).
 * - Las filas NO son clickeables: el cobro se hace desde el wizard (el panel es
 *   informativo). Sin señales de clic, como el resto de las tarjetas del panel.
 */
export function PeriodosTrabajoLista({
  items,
  currency,
}: {
  items: ItemPendienteOut[];
  /** ISO 4217 de la moneda predeterminada del usuario. */
  currency: string;
}) {
  if (items.length === 0) {
    return (
      <p className="py-3 text-[13px] text-subtitle">
        No hay jornadas ni tareas pendientes de cobro.
      </p>
    );
  }

  // Un grupo por trabajo, ordenado por el ítem más reciente de cada uno (los
  // trabajos con actividad más nueva primero). Los ítems vienen del backend
  // ordenados por fecha DESC.
  const grupos = new Map<string, ItemPendienteOut[]>();
  for (const i of items) {
    const nombre = i.trabajoNombre || SIN_TRABAJO;
    const lista = grupos.get(nombre);
    if (lista) lista.push(i);
    else grupos.set(nombre, [i]);
  }
  const total = items.reduce((acc, i) => acc + (i.monto || 0), 0);

  return (
    <>
      {/* Encabezado del panel: chip + cantidad de ítems pendientes + total. */}
      <div className="flex items-center gap-1.5 pb-1.5">
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-success/45 bg-success/10 px-1.5 py-px text-[9px] font-semibold tracking-wide text-success uppercase">
          <CalendarClock className="h-2.5 w-2.5" />
          Por cobrar
        </span>
        <span className="text-[12.5px] text-subtitle">· {items.length}</span>
        <span className="ml-auto text-[13.5px] font-semibold tabular-nums text-success">
          {numberToCurrency(total, currency)}
        </span>
      </div>

      {/* Una ficha por trabajo, siempre en 1 columna (mobile-first): el ancho
          disponible alcanza a 320 px y no hay scroll horizontal. */}
      <div className="flex flex-col gap-2 pt-1">
        {[...grupos.entries()].map(([trabajo, lista]) => {
          const subtotal = lista.reduce((acc, i) => acc + (i.monto || 0), 0);
          // La propina NO entra en el subtotal: es ingreso por su propio
          // depósito, así que se informa aparte.
          const propina = lista.reduce((acc, i) => acc + (i.montoPropina || 0), 0);
          return (
            <div
              key={trabajo}
              className="rounded-[10px] border border-border bg-muted px-3 py-2.5"
            >
              {/* Línea 1: trabajo + subtotal. `items-baseline` alinea el monto
                  con el nombre; si el nombre ocupa 2 líneas, la fila crece en
                  vez de recortarse. */}
              <div className="flex items-baseline gap-2.5">
                <p className="min-w-0 flex-1 text-[13.5px] font-semibold break-words text-header">
                  {trabajo}
                </p>
                <span className="shrink-0 text-[14.5px] font-semibold tabular-nums text-success">
                  {numberToCurrency(subtotal, currency)}
                </span>
              </div>
              {/* Línea 2: qué hay pendiente (cantidad + rango de fechas). */}
              <p className="mt-0.5 flex items-baseline gap-2 text-[11px] leading-[15px] text-subtitle">
                <span className="min-w-0">
                  {conteo(lista)} · {rangoFechas(lista.map((i) => i.fecha))}
                </span>
                {propina > 0 && (
                  <span className="ml-auto shrink-0 text-success">
                    propina {numberToCurrency(propina, currency)}
                  </span>
                )}
              </p>
            </div>
          );
        })}
      </div>
    </>
  );
}
