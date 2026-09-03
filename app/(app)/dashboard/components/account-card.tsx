"use client";

import { useState } from "react";
import {
  CalendarCheck,
  CalendarClock,
  Landmark,
  MoreVertical,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { SparkLineChart } from "./sparkline-chart";
import { AccountActionsSheet } from "./account-actions-sheet";
import { cn } from "@/lib/utils";

// Icono por tipo de cuenta para la esquina superior izquierda de la tarjeta.
// Se pinta en el mismo gris que el nombre de la cuenta (text-label).
const ICONOS_POR_TIPO: Record<string, LucideIcon> = {
  "Cuenta Bancaria": Landmark,
  "Caja Fisica": Wallet,
  "Períodos a Cobrar": CalendarClock,
  "Períodos Actuales": CalendarCheck,
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
  /** Tarjeta sintética con menú de una sola acción (ej. Períodos Actuales → "jornada"). */
  menuAccion?: "jornada" | "cobro";
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
          <p className="mt-0.5 truncate text-[18px] font-semibold leading-7 tracking-tight text-value">
            {value}
          </p>
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
  const menuButton = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setSheetOpen(true);
      }}
      className="absolute right-2 top-2 rounded p-1 text-subtitle transition-colors hover:bg-muted hover:text-header"
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
          onClick={onOpen}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen();
            }
          }}
          className={cn(base, "w-full cursor-pointer text-left", className)}
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

  // Tarjeta sintética con menú de una sola acción (Períodos a Cobrar → cobro,
  // Períodos Actuales → jornada): clicable (abre el popup de períodos, si se
  // provee onOpen) + botón ⋮ con el sheet de esa única acción.
  if (menuAccion) {
    const clicable = onOpen != null;
    return (
      <>
        <div
          role={clicable ? "button" : undefined}
          tabIndex={clicable ? 0 : undefined}
          onClick={clicable ? onOpen : undefined}
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
            className
          )}
        >
          {content}
          {menuButton}
        </div>
        <AccountActionsSheet
          cuenta={{ nombre: title, saldo: value }}
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          soloMovimiento={menuAccion}
        />
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
