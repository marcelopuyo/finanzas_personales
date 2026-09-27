"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { usePendingNav } from "@/components/ui/nav-progress";
import { Modal } from "@/components/ui/modal";
import {
  eliminarJornadaTrabajo,
  eliminarTareaTrabajo,
} from "@/backend/src/actions/movimientos";
import type {
  ItemPendienteOut,
  LiquidacionOut,
} from "@/backend/src/queries/trabajos";
import { numberToCurrency } from "@/lib/utils";
import { obtenerItemEditable } from "./actions";
import { AccionesFab } from "./components/acciones-fab";
import { ItemEditModal } from "./components/item-edit-modal";
import { PeriodosGrid } from "./components/periodos-grid";
import type { ItemEditable } from "./tipos";

/**
 * Pantalla **"Períodos de trabajo"** (`/trabajo`) — destino del panel "Trabajo"
 * del dashboard.
 *
 * **Una sola grilla** (decisión del usuario 2026-09-26): las dos cosas que sabe
 * hacer la pantalla conviven en la misma lista y con el **mismo diseño de fila**
 * (sin tarjetas) — un **trabajo con jornadas/tareas pendientes** y una
 * **liquidación ya cobrada** —, ordenadas por la fecha más reciente de cada fila.
 * Lo único que las distingue estéticamente es el **color del monto**: **verde**
 * lo que falta cobrar, **blanco** lo ya cobrado.
 *
 * Cada fila se **abre** (acordeón): en las pendientes se ven sus ítems con
 * **Editar / Eliminar** (no están congelados); en las cobradas, sus ítems en
 * **sólo lectura** (un ítem liquidado se corrige anulando el cobro y recobrando).
 *
 * El ⋯ del encabezado **ya no existe** (decisión del usuario 2026-09-26): el
 * circuito (cobrar / cargar jornada / cargar tarea) vive en el **FAB ➕ con
 * speed-dial** de abajo a la derecha (`components/acciones-fab.tsx`) y
 * **"Gestionar trabajos" se maneja desde el panel "Trabajo" del dashboard**.
 */
export function TrabajoClient({
  pendientes,
  cobradosIniciales,
  hayMasCobrados,
  totalCobrados,
  cuentas,
  monedaISO,
}: {
  pendientes: ItemPendienteOut[];
  /** Primera tanda de cobradas (el resto llega con el scroll infinito). */
  cobradosIniciales: LiquidacionOut[];
  /** ¿Quedan cobradas por traer? */
  hayMasCobrados: boolean;
  /** Total de liquidaciones cobradas (resumen del encabezado). */
  totalCobrados: number;
  /** Cuentas del usuario (para el depósito de la propina al editar). */
  cuentas: { id: number; nombre: string }[];
  /** ISO 4217 de la moneda predeterminada del usuario. */
  monedaISO: string;
}) {
  const { go } = usePendingNav();
  const totalPendiente = pendientes.reduce((acc, i) => acc + (i.monto || 0), 0);
  // Ítem que se está editando: se pide COMPLETO recién al abrir el modal (la
  // lista de la pantalla no trae la hora de la tarea ni la cuenta de la propina).
  const [itemEditando, setItemEditando] = useState<ItemEditable | null>(null);
  // Ítem pendiente de confirmación de borrado.
  const [aEliminar, setAEliminar] = useState<ItemPendienteOut | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const abrirEdicion = async (i: ItemPendienteOut) => {
    try {
      setItemEditando(await obtenerItemEditable(i.tipo, i.id));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo abrir el ítem"
      );
    }
  };

  const eliminar = async () => {
    if (!aEliminar || eliminando) return;
    setEliminando(true);
    try {
      if (aEliminar.tipo === "jornada") {
        await eliminarJornadaTrabajo(aEliminar.id);
      } else {
        await eliminarTareaTrabajo(aEliminar.id);
      }
      toast.success(
        aEliminar.tipo === "jornada" ? "Jornada eliminada" : "Tarea eliminada"
      );
      setAEliminar(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo eliminar el ítem"
      );
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl pb-24 pt-4 lg:pt-0">
      {/* Encabezado: volver + título. **Sin ⋯**: "Gestionar trabajos" se maneja
          desde el panel "Trabajo" del dashboard y las acciones del circuito
          viven en el FAB ➕ (abajo a la derecha). */}
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => go("/dashboard", "back")}
          className="rounded-lg p-1.5 text-subtitle transition-colors hover:bg-muted hover:text-header"
          aria-label="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="min-w-0 truncate text-[18px] font-semibold text-header">
          Períodos de trabajo
        </h1>
      </div>

      {/* Resumen de una línea (no es un panel): el total que falta cobrar es el
          único dato que la grilla no muestra en conjunto. */}
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 text-[12.5px] text-subtitle">
        <span>
          Por cobrar{" "}
          <span className="font-semibold tabular-nums text-success">
            {numberToCurrency(totalPendiente, monedaISO)}
          </span>
          {pendientes.length > 0 && <> · {pendientes.length} ítems</>}
        </span>
        <span className="ml-auto">{totalCobrados} cobrados</span>
      </div>

      {/* UNA sola grilla: primero los pendientes (monto verde) y después las
          cobradas (monto blanco), con el mismo diseño de fila y scroll
          infinito para lo cobrado. */}
      {pendientes.length === 0 && totalCobrados === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-card text-[13px] text-subtitle">
          Sin datos disponibles
        </div>
      ) : (
        <PeriodosGrid
          pendientes={pendientes}
          cobradosIniciales={cobradosIniciales}
          hayMasCobrados={hayMasCobrados}
          currency={monedaISO}
          onEditar={(i) => void abrirEdicion(i)}
          onEliminar={setAEliminar}
        />
      )}

      {/* Acciones del circuito (cobrar / cargar jornada / cargar tarea): FAB ➕
          con speed-dial, abajo a la derecha de la pantalla. */}
      <AccionesFab volverA="/trabajo" />

      {/* Formulario de edición de un ítem pendiente (modal centrado). */}
      {itemEditando && (
        <ItemEditModal
          item={itemEditando}
          cuentas={cuentas}
          onClose={() => setItemEditando(null)}
          onSaved={() => setItemEditando(null)}
        />
      )}

      {/* Eliminar es destructivo: siempre con confirmación. */}
      <Modal
        open={!!aEliminar}
        onClose={() => {
          if (!eliminando) setAEliminar(null);
        }}
        title={
          aEliminar?.tipo === "jornada" ? "Eliminar jornada" : "Eliminar tarea"
        }
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAEliminar(null)}
              disabled={eliminando}
              className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-card-foreground transition-colors hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void eliminar()}
              disabled={eliminando}
              className="rounded-lg bg-danger px-3 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {eliminando ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        }
      >
        <p className="text-[13px] leading-5 text-card-foreground">
          ¿Eliminar {aEliminar?.tipo === "jornada" ? "la jornada" : "la tarea"}{" "}
          del {aEliminar?.fecha.split("-").reverse().join("/")}?{" "}
          {aEliminar?.montoPropina ? (
            <span className="text-subtitle">
              La propina depositada ({numberToCurrency(aEliminar.montoPropina, monedaISO)})
              se revierte de la cuenta.
            </span>
          ) : (
            <span className="text-subtitle">Esta acción no se puede deshacer.</span>
          )}
        </p>
      </Modal>
    </div>
  );
}
