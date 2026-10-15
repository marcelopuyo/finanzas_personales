"use client";

import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { LiquidacionCerradaFuente } from "@/lib/cobros-estimados";
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
import { dateTimeToString, numberToCurrency } from "@/lib/utils";
import { SIN_TRABAJO } from "@/lib/filtros-dashboard";
import { useVentanasCobro } from "./components/use-ventanas-cobro";
import { solicitarActualizacionDashboard } from "@/lib/dashboard-cache";
import { obtenerItemEditable } from "./actions";
import { ItemEditModal } from "./components/item-edit-modal";
import { PeriodosGrid } from "./components/periodos-grid";
import type { ItemEditable } from "./tipos";

/**
 * Pantalla **"Períodos de trabajo"** (`/trabajo`) — destino del panel "Trabajo"
 * del dashboard.
 *
 * Los períodos pendientes y las liquidaciones cobradas comparten el **mismo
 * diseño de fila** (sin tarjetas) y se separan en pestañas al mostrarse embebidos
 * en Ingresos: **En curso**, **Por cobrar** y **Cobrados**. Dentro de cada pestaña
 * se ordenan por la fecha más reciente.
 * Lo único que las distingue estéticamente es el **color del monto**: **verde**
 * lo que falta cobrar, **blanco** lo ya cobrado.
 *
 * Cada fila se **abre** (acordeón): en las pendientes se ven sus ítems con
 * **Editar / Eliminar mediante swipe** (no están congelados); en las cobradas,
 * sus ítems en **sólo lectura** (un ítem liquidado se corrige anulando el cobro
 * y recobrando).
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
  embebido = false,
  hoyServidor,
  ingresosDetalle,
  filtroTrabajos,
}: {
  pendientes: ItemPendienteOut[];
  /** Primera tanda de cobradas (el resto llega con el scroll infinito). */
  cobradosIniciales: LiquidacionOut[];
  /** ¿Quedan cobradas por traer? */
  hayMasCobrados: boolean;
  /** Total de liquidaciones cobradas (solo para el estado vacío de la grilla). */
  totalCobrados: number;
  /**
   * **Filtro por trabajo** del panel de Ingresos (2026-10-03): los pendientes se
   * acotan en memoria y las cobradas se piden filtradas al server. Vacío = todo.
   */
  filtroTrabajos?: string[];
  /** Cuentas del usuario (para el depósito de la propina al editar). */
  cuentas: { id: number; nombre: string }[];
  /** ISO 4217 de la moneda predeterminada del usuario. */
  monedaISO: string;
  /**
   * **Modo embebido** (2026-10-01, rama `rediseno-ui`): la pantalla de Ingresos
   * muestra esta grilla como **listado unificado debajo de su panel de gráficos**
   * ⇒ se omite la cabecera (volver + título) y el padding de pantalla.
   */
  embebido?: boolean;
  /**
   * **"Hoy" del server** (`YYYY-MM-DD`): es la fecha de la **primera pintada** del
   * reparto de ventanas. Después del montaje, si la fecha local del navegador ya
   * cambió (el server está en **UTC**: de noche ya es el día siguiente), se
   * recalcula con la local — ver `useVentanasCobro` (§211).
   */
  hoyServidor?: string;
  /** Liquidaciones con cobro real (las "cerradas" que usa la inferencia). */
  ingresosDetalle?: LiquidacionCerradaFuente[];
}) {
  const { go } = usePendingNav();

  /**
   * **Pendientes filtrados por trabajo** (2026-10-03): el filtro del panel de
   * Ingresos acota los pendientes **en memoria** (vienen todos) y, con eso, también
   * el resumen y las ventanas de cobro. Sin filtro se usa la lista original.
   */
  const pendientesFiltrados = useMemo(
    () =>
      filtroTrabajos?.length
        ? pendientes.filter((i) =>
            filtroTrabajos.includes(i.trabajoNombre || SIN_TRABAJO)
          )
        : pendientes,
    [pendientes, filtroTrabajos]
  );

  /** Reparto de los pendientes en ventanas + resumen de las dos ventanas: se
      calculan con la fecha **local** del navegador (§211). */
  const { secciones, porCobrar, enCurso } = useVentanasCobro({
    hoyServidor,
    // Con el **filtro por trabajo** los pendientes ya llegan acotados: el reparto (y
    // el resumen) salen de ahí.
    items: pendientesFiltrados,
    liquidaciones: ingresosDetalle ?? [],
    // ⚠️ Un array **nuevo** en cada render dispararía el memo ⇒ se pasa un booleano.
    forzar: Boolean(filtroTrabajos?.length),
  });
  /**
   * Total de cobradas: el del server, o el que avisa la grilla cuando hay
   * **filtro por trabajo** (ese listado se pagina filtrado). ⚠️ Ya **no** se
   * muestra en el resumen: se usa solo para el estado vacío.
   */
  const [totalCobradosFiltrado, setTotalCobradosFiltrado] = useState(totalCobrados);
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
      solicitarActualizacionDashboard();
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
    <div className={embebido ? undefined : "mx-auto max-w-5xl pb-24 pt-4 lg:pt-0"}>
      {!embebido && (
        <>
          {/* Encabezado: volver + título. **Sin ⋯**: "Gestionar trabajos" se maneja
              desde el ⋯ de la sección de trabajo en Ingresos y las acciones del
              circuito viven al pie del mini-panel de Ingresos. */}
          <div className="mb-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => go("/dashboard", "back")}
              className="rounded-lg p-1.5 text-subtitle transition-colors hover:bg-muted hover:text-header"
              aria-label="Volver"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="min-w-0 truncate text-[18px] text-header">
              Períodos de trabajo
            </h1>
          </div>
        </>
      )}

      {/* En Ingresos se mantienen visibles las pestañas aunque no haya datos,
          para que cada estado tenga su propio estado vacío. */}
      {pendientesFiltrados.length === 0 &&
      (filtroTrabajos?.length
        ? totalCobradosFiltrado === 0
        : totalCobrados === 0) &&
      !embebido ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-card text-[13px] text-subtitle">
          Sin datos disponibles
        </div>
      ) : (
        <PeriodosGrid
          secciones={secciones}
          cobradosIniciales={cobradosIniciales}
          hayMasCobrados={hayMasCobrados}
          currency={monedaISO}
          enCurso={enCurso}
          porCobrar={porCobrar}
          onEditar={(i) => void abrirEdicion(i)}
          onEliminar={setAEliminar}
          filtroTrabajos={filtroTrabajos}
          onTotalCobrados={setTotalCobradosFiltrado}
        />
      )}

      {/* ⚠️ Las acciones del circuito (cobrar / cargar jornada / cargar tarea) YA
          NO viven acá: desde el 2026-10-03 son botones al pie del **mini-panel de
          Ingresos** (`AccionCirculo` en `dashboard-client.tsx`), con el mismo
          estilo que los de las tarjetas de Inicio — antes era un FAB ➕ flotante
          en la esquina inferior derecha. */}

      {/* Formulario de edición de un ítem pendiente (modal centrado). */}
      {itemEditando && (
        <ItemEditModal
          item={itemEditando}
          cuentas={cuentas}
          onClose={() => setItemEditando(null)}
          onSaved={() => {
            setItemEditando(null);
            solicitarActualizacionDashboard();
          }}
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
          del {dateTimeToString(aEliminar?.fecha)}?{" "}
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
