"use client";

import { useState } from "react";
import {
  CalendarCheck,
  CalendarClock,
  CircleCheck,
  Landmark,
  MoreVertical,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { SparkLineChart } from "./sparkline-chart";
import {
  AccountActionsSheet,
  type AccionSintetica,
} from "./account-actions-sheet";
import { useLongPress } from "@/lib/long-press";
import { cn } from "@/lib/utils";

// Icono por tipo de cuenta para la esquina superior izquierda de la tarjeta.
// Se pinta en el mismo gris que el nombre de la cuenta (text-label).
const ICONOS_POR_TIPO: Record<string, LucideIcon> = {
  "Cuenta Bancaria": Landmark,
  "Caja Fisica": Wallet,
  "Por cobrar": CalendarClock,
  "Actuales": CalendarCheck,
  "Finalizados": CircleCheck,
};

interface AccountCardProps {
  id?: number;
  title: string;
  value: string;
  labels: string[];
  values: number[];
  /** Código ISO de la moneda de la cuenta (formatea el tooltip del sparkline). */
  monedaISO?: string;
  /** Nombre del tipo de cuenta (para el icono de la esquina superior izquierda). */
  tipo?: string;
  className?: string;
  /** Se invoca al hacer click en una tarjeta de cuenta real (abre el historial). */
  onOpen?: () => void;
  /** Tarjeta sintética con menú de acción(es) (ej. Actuales → jornada/tarea). */
  menuAccion?: AccionSintetica[];
}

export function AccountCard({
  id,
  title,
  value,
  labels,
  values,
  monedaISO,
  tipo,
  className,
  onOpen,
  menuAccion,
}: AccountCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const esCuentaReal = id != null && onOpen != null;
  // Tarjeta con menú de acción(es) propio (tarjetas sintéticas: Actuales →
  // jornada/tarea/nuevo período).
  const conMenu = menuAccion != null && menuAccion.length > 0;
  /** ¿La tarjeta tiene acciones propias (bottom sheet)? */
  const tieneAcciones = esCuentaReal || conMenu;
  // LONG PRESS en mobile (2026-09-17): manteniendo el dedo ~500 ms sobre la
  // tarjeta se abre el MISMO bottom sheet que antes abría el botón ⋮ — que ahora
  // se oculta en los equipos táctiles (`pointer-coarse`, ver `menuButton`) y se
  // mantiene en los de mouse. El `click` que el navegador emite igual al soltar
  // se descarta con `consumirClick()`.
  const { props: longPressProps, consumirClick } = useLongPress(
    () => setSheetOpen(true),
    { habilitado: tieneAcciones }
  );
  // Icono del tipo de cuenta (Landmark como fallback para tipos desconocidos).
  const Icon = ICONOS_POR_TIPO[tipo ?? ""] ?? Landmark;

  const content = (
    <>
      <div className="flex items-start gap-2.5">
        {/* Icono del tipo de cuenta (arriba a la izquierda, a la altura del
            nombre de la cuenta), SIN fondo, en el mismo gris (text-label). */}
        <Icon className="h-4.5 w-4.5 flex-none text-label" />
        <div className="min-w-0">
          <p className="text-[12px] leading-4 text-label">{title}</p>
          {/* Las tarjetas sin monto (ej. "Finalizados") muestran SOLO el nombre,
              pero reservan la MISMA altura que la línea del importe
              (mt-0.5 + leading-7 = 30px) para medir igual que las demás: en
              mobile el grid es de 1 columna, así que cada tarjeta está en su
              propia fila y el `stretch` del grid no las iguala. */}
          {value ? (
            <p className="mt-0.5 truncate text-[18px] font-semibold leading-7 tracking-tight text-value">
              {value}
            </p>
          ) : (
            <div className="mt-0.5 h-7" aria-hidden="true" />
          )}
        </div>
      </div>
      {/* El área del gráfico siempre ocupa la misma altura (mt-2 + h-10 = 48px):
          si no hay datos se reserva el espacio vacío para que TODAS las tarjetas
          tengan el mismo alto en mobile (con o sin sparkline).
          Con 1 valor el sparkline dibuja una línea horizontal (0 o 1 movimiento
          en el último mes); solo las tarjetas SIN valores (sintéticas) dejan el
          espacio reservado. */}
      <div className="mt-2">
        {values.length >= 1 ? (
          <SparkLineChart data={values} labels={labels} currency={monedaISO} />
        ) : (
          <div className="h-10" aria-hidden="true" />
        )}
      </div>
    </>
  );

  const base =
    "relative flex flex-col justify-start rounded-lg border border-border bg-muted p-4 transition-colors";

  // Botón de opciones (⋮) que abre el bottom sheet de acciones.
  // ⚠️ En mobile se OCULTA (`pointer-coarse:hidden`): ahí el sheet se abre con
  // **long press** sobre la tarjeta (decisión del usuario 2026-09-17).
  const menuButton = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setSheetOpen(true);
      }}
      className="absolute right-2 top-2 rounded p-1 text-subtitle transition-colors pointer-coarse:hidden hover:bg-muted hover:text-header"
      aria-label={`Opciones de ${title}`}
      title="Opciones"
    >
      <MoreVertical className="h-4 w-4" />
    </button>
  );

  // Tarjeta de cuenta real: clicable (abre historial) + botón de opciones (⋮)
  // con el bottom sheet de acciones completo. Se usa un <div> con role="button"
  // (no un <button>) para no anidar botones (el menú es un <button> real).
  if (esCuentaReal) {
    return (
      <>
        <div
          role="button"
          tabIndex={0}
          {...longPressProps}
          onClick={() => {
            // El `click` posterior a un long press se descarta acá: si no, se
            // abriría el historial ENCIMA del sheet de acciones.
            if (consumirClick()) return;
            onOpen();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen();
            }
          }}
          className={cn(
            base,
            "w-full cursor-pointer text-left",
            // Evita que el long press seleccione texto o abra el callout de iOS.
            tieneAcciones && "select-none [-webkit-touch-callout:none]",
            className
          )}
        >
          {content}
          {menuButton}
        </div>
        <AccountActionsSheet
          cuenta={{ id: id!, nombre: title, saldo: value }}
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
        />
      </>
    );
  }

  // Tarjeta sintética: puede ser clicable (abre el popup de períodos si se
  // provee onOpen) y/o traer menú de acción(es) —que en mobile se abre con
  // long press en vez del ⋮ (Actuales → jornada/tarea/nuevo período)—. "Por
  // cobrar" ya NO trae menú: el cobro se lanza desde el icono por fila de su
  // popup, así que la tarjeta queda clicable sin botón ⋮ (solo abre el listado).
  const clicable = onOpen != null;
  if (conMenu || clicable) {
    return (
      <>
        <div
          role={clicable ? "button" : undefined}
          tabIndex={clicable ? 0 : undefined}
          {...longPressProps}
          onClick={
            clicable
              ? () => {
                  if (consumirClick()) return;
                  onOpen();
                }
              : undefined
          }
          onKeyDown={
            clicable
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen();
                  }
                }
              : undefined
          }
          className={cn(
            base,
            clicable && "w-full cursor-pointer text-left",
            tieneAcciones && "select-none [-webkit-touch-callout:none]",
            className
          )}
        >
          {content}
          {conMenu && menuButton}
        </div>
        {conMenu && (
          <AccountActionsSheet
            cuenta={{ nombre: title, saldo: value }}
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            soloMovimiento={menuAccion}
          />
        )}
      </>
    );
  }

  return <div className={cn(base, className)}>{content}</div>;
}

export function AccountCardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-2.5">
        <div className="h-4.5 w-4.5 flex-none rounded bg-border" />
        <div>
          <div className="mb-1.5 h-3 w-20 rounded bg-border" />
          <div className="mb-3 h-6 w-28 rounded bg-border" />
        </div>
      </div>
      <div className="h-10 w-full rounded bg-border" />
    </div>
  );
}
