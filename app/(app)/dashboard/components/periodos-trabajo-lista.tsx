"use client";

import { CalendarCheck, CalendarClock } from "lucide-react";
import type { PeriodoTrabajoOut } from "@/backend/src/queries/trabajos";
import { periodoCobrado } from "@/backend/src/lib/jornadas";
import { cn, dateTimeToString, numberToCurrency } from "@/lib/utils";

/** Suma el monto PENDIENTE de cobro del grupo: excluye los períodos YA COBRADOS
    (con el cobro adelantado del 2026-09-14 un período puede seguir "en curso"
    pero estar pago; ese dinero ya no se espera). */
function totalPendiente(periodos: PeriodoTrabajoOut[]): number {
  return periodos.reduce(
    (acc, p) => acc + (periodoCobrado(p) ? 0 : p.montoACobrar || 0),
    0
  );
}

/** Rango de fechas de la fila: "dd-mm-aaaa al dd-mm-aaaa". Sin la palabra
    "Desde" ni la fecha estimada de cobro (pedidos del usuario 2026-09-13, para
    que el texto sea más corto). */
function rangoPeriodo(p: PeriodoTrabajoOut): string {
  return `${dateTimeToString(p.fechaDesde)} al ${dateTimeToString(
    p.fechaHasta
  )}`;
}

/** Chip del estado del grupo (colores elegidos por el usuario): verde = plata
    a cobrar (entra), rojo = período todavía en curso. */
function ChipEstado({ cobrar }: { cobrar: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-px text-[9px] font-semibold tracking-wide uppercase",
        cobrar
          ? "border-success/45 bg-success/10 text-success"
          : "border-danger/45 bg-danger/10 text-danger"
      )}
    >
      {cobrar ? (
        <CalendarClock className="h-2.5 w-2.5" />
      ) : (
        <CalendarCheck className="h-2.5 w-2.5" />
      )}
      {cobrar ? "Por cobrar" : "En curso"}
    </span>
  );
}

interface Props {
  /** Períodos cerrados (fecha final < hoy) que todavía no se cobraron. */
  porCobrar: PeriodoTrabajoOut[];
  /** Períodos vigentes (ya empezaron y no terminaron) y no cobrados. */
  enCurso: PeriodoTrabajoOut[];
  /** ISO 4217 de la moneda predeterminada del usuario. */
  currency: string;
}

/**
 * Listado del panel "Trabajo" (decisión 2026-09-13): reemplaza las tarjetas
 * sintéticas ("Por cobrar" / "Actuales") por DOS grupos de períodos con **un
 * único chip por grupo** (en el encabezado, junto al total) — primero los "Por
 * cobrar" (los que llevan más tiempo sin cobrarse) y después los "En curso"
 * (los que terminan antes). Se listan TODOS los períodos pendientes de cada
 * grupo, sin tope de filas (decisión 2026-09-13).
 *
 * ⚠️ **Las filas NO son clickeables** (decisión del usuario 2026-09-17): son
 * `<div>` sin `hover`/`active`/cursor, es decir **sin ninguna señal visual de
 * clic**. El clic que abre el CRUD de períodos lo maneja el PANEL COMPLETO
 * (ver `dashboard-client.tsx`: cualquier punto del panel, salvo el menú ⋯).
 */
export function PeriodosTrabajoLista({ porCobrar, enCurso, currency }: Props) {
  const grupos = [
    {
      cobrar: true,
      label: "Por cobrar",
      visibles: porCobrar,
      monto: totalPendiente(porCobrar),
    },
    {
      cobrar: false,
      label: "En curso",
      visibles: enCurso,
      monto: totalPendiente(enCurso),
    },
  ];

  if (porCobrar.length === 0 && enCurso.length === 0) {
    return (
      <p className="py-3 text-[13px] text-subtitle">
        No hay períodos en curso ni por cobrar.
      </p>
    );
  }

  return (
    <>
      {grupos.map(({ cobrar, label, visibles, monto }, i) => (
        // El 2º grupo se separa con aire (no con línea) del 1º.
        <div key={label} className={i > 0 ? "mt-4" : undefined}>
          {/* Encabezado del grupo: UN chip + cantidad + total del grupo. */}
          <div className="flex items-center gap-1.5 pb-1.5">
            <ChipEstado cobrar={cobrar} />
            <span className="text-[12.5px] text-subtitle">· {visibles.length}</span>
            <span className="ml-auto text-[13.5px] font-semibold text-value">
              {numberToCurrency(monto, currency)}
            </span>
          </div>
          {visibles.map((p) => {
            // Cobrado = ya tiene `fechaDeCobro` real. Con el COBRO ADELANTADO
            // (decisión del usuario 2026-09-14) un período fijo/horas_fijas puede
            // estar cobrado y seguir EN CURSO: sigue listado en este grupo y se
            // marca con el tag para no confundirlo con uno pendiente.
            const cobrado = periodoCobrado(p);
            // Fila SIN señales de clic (pedido del usuario 2026-09-17): ni
            // `hover`/`active`, ni `cursor: pointer`, ni `<Link>`/`<button>`
            // (el `<a>` mostraría el cursor de mano). La navegación la dispara el
            // panel completo desde `dashboard-client.tsx`.
            return (
              <div
                key={p.id}
                className="border-t border-border py-2.5 [-webkit-tap-highlight-color:transparent]"
              >
                {/* Fila 1: trabajo + monto. Fila 2: fechas (+ tag si ya se cobró). */}
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-[13.5px] font-medium text-header">
                    {p.trabajo?.nombre ?? "—"}
                  </p>
                  <span className="shrink-0 text-[13.5px] font-semibold text-value">
                    {numberToCurrency(p.montoACobrar || 0, currency)}
                  </span>
                </div>
                {/* Sin `truncate`: en pantallas muy chicas (320px) las fechas
                    bajan a una segunda línea en vez de cortarse. */}
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p className="text-[11.5px] text-subtitle">{rangoPeriodo(p)}</p>
                  {cobrado && (
                    <span className="shrink-0 rounded-full border border-success/45 bg-success/10 px-1.5 py-px text-[9px] font-semibold tracking-wide text-success uppercase">
                      Cobrado
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}
