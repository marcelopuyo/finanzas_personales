"use client";

import { useState } from "react";
import { MoreVertical } from "lucide-react";
import { SparkLineChart } from "./sparkline-chart";
import { AccountActionsSheet } from "./account-actions-sheet";
import { cn } from "@/lib/utils";

interface AccountCardProps {
  id?: number;
  title: string;
  value: string;
  labels: string[];
  values: number[];
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
  className,
  onOpen,
  menuAccion,
}: AccountCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const esCuentaReal = id != null && onOpen != null;

  const content = (
    <>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] leading-4 text-label">{title}</p>
          <p className="mt-0.5 text-[18px] font-semibold leading-7 tracking-tight text-value">
            {value}
          </p>
        </div>
      </div>
      {/* El área del gráfico siempre ocupa la misma altura (mt-2 + h-10 = 48px):
          si no hay datos suficientes se reserva el espacio vacío para que TODAS
          las tarjetas tengan el mismo alto en mobile (con o sin sparkline).
          La variante "line" del sparkline necesita >= 2 puntos para dibujar;
          con 0 o 1 punto se deja el espacio reservado. */}
      <div className="mt-2">
        {values.length >= 2 ? (
          <SparkLineChart data={values} labels={labels} />
        ) : (
          <div className="h-10" aria-hidden="true" />
        )}
      </div>
    </>
  );

  const base =
    "relative flex flex-col justify-start rounded-lg border border-border bg-card p-4 transition-colors";

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
          onVerHistorial={onOpen}
        />
      </>
    );
  }

  // Tarjeta sintética con menú de una sola acción (Períodos a Cobrar → cobro,
  // Períodos Actuales → jornada): no es clicable pero tiene el botón ⋮ y un
  // sheet con solo esa opción.
  if (menuAccion) {
    return (
      <>
        <div className={cn(base, className)}>
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
      <div className="mb-1.5 h-3 w-20 rounded bg-border" />
      <div className="mb-3 h-6 w-28 rounded bg-border" />
      <div className="h-10 w-full rounded bg-border" />
    </div>
  );
}
