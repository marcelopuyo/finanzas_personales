"use client";

import { useRef, useState } from "react";
import { ArrowLeft, GripVertical } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import type { CuentaOut } from "@/backend/src/queries/maestros";
import { cn, numberToCurrency } from "@/lib/utils";

/**
 * Pantalla para REORDENAR las cuentas (arrastre unificado: dedo en mobile,
 * mouse en desktop) con dnd-kit. Cada arrastre persiste de inmediato vía
 * `onReorder(ids)`; si la persistencia falla se revierte el orden local.
 * La grilla normal del CRUD queda intacta (se muestra solo en modo ordenar).
 */
export function OrdenarCuentas({
  cuentas,
  onReorder,
  onDone,
}: {
  cuentas: CuentaOut[];
  /** Persiste el nuevo orden (ids en la posición final). Debe lanzar si falla. */
  onReorder: (ids: number[]) => Promise<void>;
  /** Cierra la pantalla de ordenar (vuelve a la grilla del CRUD). */
  onDone: () => void;
}) {
  const [items, setItems] = useState(cuentas);
  // Copia previa para revertir si la persistencia falla.
  const prevRef = useRef(items);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    prevRef.current = items;
    const oldIndex = items.findIndex((c) => c.id === active.id);
    const newIndex = items.findIndex((c) => c.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    try {
      await onReorder(next.map((c) => c.id));
    } catch {
      setItems(prevRef.current);
      toast.error("No se pudo guardar el nuevo orden de las cuentas");
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      {/* Encabezado: volver + título + "Listo" */}
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDone}
            aria-label="Volver a las cuentas"
            className="rounded-lg p-1.5 text-subtitle transition-colors hover:bg-muted hover:text-header"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-[18px] font-semibold text-header">
            Ordenar cuentas
          </h1>
        </div>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex shrink-0 items-center rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Listo
        </button>
      </div>
      <p className="mb-4 text-[13px] text-subtitle">
        Mantené presionada (o arrastrá con el mouse) una cuenta para moverla.
        El orden se guarda automáticamente.
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={items.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {items.map((cuenta, i) => (
              <SortableRow key={cuenta.id} cuenta={cuenta} index={i} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableRow({
  cuenta,
  index,
}: {
  cuenta: CuentaOut;
  index: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cuenta.id });
  const iso = cuenta.moneda?.codigoISO ?? "ARS";

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5",
        isDragging
          ? "border-primary/60 opacity-90 shadow-lg"
          : "border-border"
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Mover cuenta ${cuenta.nombre}`}
        className="flex h-8 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-subtitle transition-colors hover:bg-muted active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-semibold text-subtitle">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-card-foreground">
          {cuenta.nombre}
        </p>
        <p className="truncate text-[12px] text-subtitle">
          {cuenta.tipo?.nombre ?? "—"}
          {cuenta.moneda ? ` · ${cuenta.moneda.nombre}` : ""}
        </p>
      </div>
      <p className="shrink-0 text-[13px] font-medium text-value">
        {numberToCurrency(cuenta.saldo, iso)}
      </p>
    </div>
  );
}
