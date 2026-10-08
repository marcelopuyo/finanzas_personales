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
import { etiquetaCantidadItems } from "@/lib/trabajo-texto";
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
   * **Resumen de las tandas**: una línea por ventana estimada, con su **monto** y
   * su **cantidad de ítems**.
   *
   * 🔑 2026-10-04 (pedido del usuario): "Por cobrar" (ventana ya cerrada ⇒
   * cobrable ahora) y "En curso" (ventana en curso o futura ⇒ todavía no). Se
   * **sacaron** el total "Pendiente" y la cantidad de cobrados (los cobrados ya
   * tienen su propio listado) y **no** se muestran los ítems **sin período
   * estimado** (`sinPeriodo`): si no se puede estimar, no hay sección. Cada línea
   * pinta su monto con el color de su sección —verde lo cobrable, ámbar lo que
   * falta (§211), mismo criterio que las filas y el panel "Trabajo"— y **solo
   * aparece si tiene ítems**.
   *
   * 🔑 Desde el 2026-10-03 viaja **dentro del panel** de la grilla en el modo
   * embebido (antes flotaba sobre el fondo, junto al título "Trabajo").
   */
  const resumenTandas = (
    <div className="flex flex-col gap-1 text-[12.5px] text-subtitle">
      {porCobrar.items > 0 && (
        <div>
          Por cobrar{" "}
          <span className="tabular-nums text-success">
            {numberToCurrency(porCobrar.monto, monedaISO)}
          </span>
          {" · "}
          {etiquetaCantidadItems(porCobrar.items)}
        </div>
      )}
      {enCurso.items > 0 && (
        <div>
          En curso{" "}
          <span className="tabular-nums text-warning">
            {numberToCurrency(enCurso.monto, monedaISO)}
          </span>
          {" · "}
          {etiquetaCantidadItems(enCurso.items)}
        </div>
      )}
    </div>
  );

  /** ¿Hay algo que resumir? (ítems fuera de toda ventana ⇒ no hay líneas). */
  const hayResumen = porCobrar.items > 0 || enCurso.items > 0;

  /**
   * **Encabezado de la sección de trabajo** para el modo **embebido** (Ingresos):
   * solo el **resumen de tandas**, **dentro del panel** de la grilla (2026-10-03).
   *
   * ⚠️ **Sin título y sin ⋯** (pedido del usuario, mismo día): el título "Trabajo" se
   * eliminó y el **⋯ pasó al mini-panel superior** de la pantalla (junto a los
   * Filtros y al monto del mes). Sin líneas de resumen no se pinta el encabezado
   * (quedaría una franja vacía con su borde).
   */
  const encabezadoSeccion = hayResumen ? (
    <div className="border-b border-border pb-2.5 pt-2.5">{resumenTandas}</div>
  ) : undefined;

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

      {!embebido && hayResumen && resumenTandas}

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
          secciones={secciones}
          cobradosIniciales={cobradosIniciales}
          hayMasCobrados={hayMasCobrados}
          currency={monedaISO}
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
