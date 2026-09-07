"use client";

import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BottomBarAction {
  /** Id único de la acción (usado como key). */
  key: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  /** Deshabilita visual e interactivamente la acción (p. ej. Editar/Eliminar
      sin una fila seleccionada). */
  disabled?: boolean;
  /** Cuando está habilitada usa el color danger (p. ej. Eliminar). */
  danger?: boolean;
  /** Cuando está habilitada usa el color primario (p. ej. Editar / Buscar activo). */
  active?: boolean;
}

interface BottomActionBarProps {
  /** Acciones del lado izquierdo (típicamente Buscar / Exportar). */
  left?: BottomBarAction[];
  /** Acciones del lado derecho (típicamente Editar / Eliminar). */
  right?: BottomBarAction[];
  /** FAB central flotante sobre la barra (típicamente "Nuevo"). */
  fabAction?: { label?: string; onClick?: () => void };
}

/**
 * Barra inferior de acciones para CRUD (patrón "bottom bar + FAB" mobile):
 * una barra única y continua con acciones a izquierda y derecha, y un botón
 * flotante (FAB) centrado sobre ella. Se oculta en lg+ (ahí se usa la toolbar
 * clásica). Es puramente presentacional: el consumidor controla el estado
 * (selección de fila, búsqueda, etc.) y provee los callbacks.
 *
 * Uso:
 *   <BottomActionBar
 *     left={[{ key: "search", label: "Buscar", icon: Search, onClick: ... }]}
 *     right={[{ key: "edit", label: "Editar", icon: Pencil, disabled: !sel, onClick: ... }]}
 *     fabAction={{ label: "Nuevo", onClick: () => router.push(createHref) }}
 *   />
 */
export function BottomActionBar({
  left = [],
  right = [],
  fabAction,
}: BottomActionBarProps) {
  const renderAction = (a: BottomBarAction) => {
    const Icon = a.icon;
    return (
      <button
        key={a.key}
        type="button"
        aria-disabled={a.disabled}
        onClick={a.disabled ? undefined : a.onClick}
        className={cn(
          "flex flex-col items-center gap-0.5 py-1 text-[10.5px] font-medium",
          a.disabled
            ? "pointer-events-none opacity-35"
            : a.danger
              ? "text-danger"
              : a.active
                ? "text-primary"
                : "text-sidebar-muted"
        )}
      >
        <Icon className="h-5 w-5" />
        <span>{a.label}</span>
      </button>
    );
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 lg:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto max-w-md px-4">
        <div className="relative">
          {/* Barra única y continua */}
          <div className="flex h-14 items-stretch justify-between rounded-[26px] border border-border bg-sidebar shadow-lg">
            <div className="flex flex-1 items-center justify-around">
              {left.map(renderAction)}
            </div>
            {/* Zona central libre: el FAB flota arriba (no se recorta la barra) */}
            <div className="w-16 shrink-0" aria-hidden="true" />
            <div className="flex flex-1 items-center justify-around">
              {right.map(renderAction)}
            </div>
          </div>
          {/* FAB centrado flotando sobre la barra */}
          {fabAction?.onClick && (
            <button
              type="button"
              onClick={fabAction.onClick}
              aria-label={fabAction.label ?? "Agregar"}
              title={fabAction.label ?? "Nuevo"}
              className="absolute left-1/2 top-0 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-background bg-header text-background shadow-lg transition-transform active:scale-95"
            >
              <Plus className="h-6 w-6" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
