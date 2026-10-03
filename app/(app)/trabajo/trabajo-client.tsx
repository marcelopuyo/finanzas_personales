"use client";

import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type {
  EstimacionTrabajo,
  LiquidacionCerradaFuente,
} from "@/lib/cobros-estimados";
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
import { obtenerItemEditable } from "./actions";
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
  embebido = false,
  estimacionesSSR,
  hoyServidor,
  ingresosDetalle,
  filtroTrabajos,
}: {
  pendientes: ItemPendienteOut[];
  /** Primera tanda de cobradas (el resto llega con el scroll infinito). */
  cobradosIniciales: LiquidacionOut[];
  /** ¿Quedan cobradas por traer? */
  hayMasCobrados: boolean;
  /** Total de liquidaciones cobradas (resumen del encabezado). */
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
   * **Reparto de los pendientes en ventanas** (por cobrar · en curso · sin período).
   * ⚠️ Igual que los badges (§211): el server (Vercel, **UTC**) lo calcula con SU
   * fecha, así que se **recalcula en el cliente** con la fecha local del navegador
   * (`useVentanasCobro`) para no adelantar el cambio de ventana.
   */
  estimacionesSSR?: EstimacionTrabajo[];
  /** "Hoy" del server (`YYYY-MM-DD`), para saber si hace falta recalcular. */
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

  /** Fecha estimada de cobro por trabajo + total cobrable: se recalculan con la
      fecha **local** del navegador (§211). */
  const { fechas: fechasCobro, totalPorCobrar } = useVentanasCobro({
    estimacionesSSR,
    hoyServidor,
    // Con el **filtro por trabajo** los pendientes se acotan antes de calcular las
    // ventanas (y se **fuerza** el recálculo: las del server son de todos).
    items: pendientesFiltrados,
    liquidaciones: ingresosDetalle ?? [],
    // ⚠️ Un array **nuevo** en cada render dispararía el memo ⇒ se pasa un booleano.
    forzar: Boolean(filtroTrabajos?.length),
  });
  const totalPendiente = pendientesFiltrados.reduce(
    (acc, i) => acc + (i.monto || 0),
    0
  );
  /**
   * Total de cobradas que se muestra en el resumen: el del server, o el que avisa
   * la grilla cuando hay **filtro por trabajo** (ese listado se pagina filtrado).
   */
  const [totalCobradosFiltrado, setTotalCobradosFiltrado] = useState(totalCobrados);
  const totalCobradosMostrado = filtroTrabajos?.length
    ? totalCobradosFiltrado
    : totalCobrados;
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

  /**
   * **Resumen de las tandas** (una línea + la de "Por cobrar"): el total que falta
   * cobrar es el único dato que la grilla no muestra en conjunto. ⚠️ Dice
   * "Pendiente" y NO "Por cobrar" para no chocar con las fichas de ventana de cada
   * fila (donde "Por cobrar" = ventana ya cerrada ⇒ cobrable ahora).
   *
   * 🔑 Desde el 2026-10-03 viaja **dentro del panel** de la grilla en el modo
   * embebido (antes flotaba sobre el fondo, junto al título "Trabajo").
   */
  const resumenTandas = (
    <div className="flex flex-col gap-1 text-[12.5px] text-subtitle">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span>
          Pendiente{" "}
          <span className="tabular-nums text-success">
            {numberToCurrency(totalPendiente, monedaISO)}
          </span>
          {pendientesFiltrados.length > 0 && <> · {pendientesFiltrados.length} ítems</>}
        </span>
        <span className="ml-auto">{totalCobradosMostrado} cobrados</span>
      </div>
      {/* Segunda línea: lo que ya se puede cobrar **ahora** (Σ de los ítems cuya
          ventana estimada cerró). Verde = plata pendiente, mismo criterio que el
          monto "Pendiente" y que el de las filas. Solo si hay algo. */}
      {totalPorCobrar > 0 && (
        <div>
          Por cobrar{" "}
          <span className="tabular-nums text-success">
            {numberToCurrency(totalPorCobrar, monedaISO)}
          </span>
        </div>
      )}
    </div>
  );

  /**
   * **Encabezado de la sección de trabajo** para el modo **embebido** (Ingresos):
   * solo el **resumen de tandas**, **dentro del panel** de la grilla (2026-10-03).
   *
   * ⚠️ **Sin título y sin ⋯** (pedido del usuario, mismo día): el título "Trabajo" se
   * eliminó y el **⋯ pasó al mini-panel superior** de la pantalla (junto a los
   * Filtros y al monto del mes).
   */
  const encabezadoSeccion = (
    <div className="border-b border-border pb-2.5 pt-2.5">{resumenTandas}</div>
  );

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

      {!embebido && resumenTandas}

      {/* UNA sola grilla: primero los pendientes (monto verde) y después las
          cobradas (monto blanco), con el mismo diseño de fila y scroll
          infinito para lo cobrado. En el modo **embebido** el encabezado de la
          sección (título + ⋯ + resumen) viaja DENTRO de este panel. */}
      {pendientesFiltrados.length === 0 &&
      (filtroTrabajos?.length
        ? totalCobradosFiltrado === 0
        : totalCobrados === 0) ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-card text-[13px] text-subtitle">
          Sin datos disponibles
        </div>
      ) : (
        <PeriodosGrid
          pendientes={pendientesFiltrados}
          cobradosIniciales={cobradosIniciales}
          hayMasCobrados={hayMasCobrados}
          currency={monedaISO}
          fechasCobro={fechasCobro}
          onEditar={(i) => void abrirEdicion(i)}
          onEliminar={setAEliminar}
          encabezado={embebido ? encabezadoSeccion : undefined}
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
