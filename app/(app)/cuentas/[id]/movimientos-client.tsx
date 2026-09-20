"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { DataTable } from "@/components/ui/data-table";
import { NavSpinner, usePendingNav } from "@/components/ui/nav-progress";
import {
  SwipeRowActions,
  type SwipeRowAction,
} from "@/components/crud/SwipeRowActions";
import { getHistorialMovimientosCuentaPaginaAction } from "@/backend/src/actions/historial-movimientos";
import { anularMovimiento } from "@/backend/src/actions/anular-movimientos";
import type {
  HistorialMovimientoOut,
  HistorialPagina,
} from "@/backend/src/queries/movimientos";
import { cn, dateTimeToString, numberToCurrency } from "@/lib/utils";
import { MovimientoRow } from "./movimiento-row";

/** Cuenta mínima que necesita la pantalla. Es SOLO LECTURA: la pantalla no
    ofrece ninguna acción sobre la cuenta (ni editar ni eliminar), es
    estrictamente el listado de sus movimientos. */
export interface CuentaMovimientos {
  id: number;
  nombre: string;
  saldo: number;
  /** ISO de la moneda de la cuenta (monto y saldo del historial). */
  monedaISO: string;
}

interface MovimientosCuentaClientProps {
  cuenta: CuentaMovimientos;
  /** Primera tanda, ya resuelta en el server: la pantalla abre con datos. */
  primeraPagina: HistorialPagina;
  /** ISO de la moneda predeterminada del usuario (equivalente secundario). */
  monedaPredeterminadaISO: string;
}

/** Filas por tanda del scroll infinito (el backend acota el valor a 1..100). */
const PAGE = 20;
/** Margen con el que se dispara la carga anticipada del scroll infinito (px). */
const PRELOAD_PX = 240;

/**
 * Pantalla de movimientos de una cuenta (`/cuentas/[id]`).
 *
 * Reemplaza al popup que se abría al tocar una cuenta en el dashboard (2026-09-20):
 * una lista de contenido se navega en una pantalla, no en un bottom sheet.
 * **Funcionalidad idéntica a la del popup** —nombre y saldo arriba, el historial
 * cronológico y la eliminación de un movimiento con confirmación— y **ninguna
 * acción sobre la cuenta**.
 *
 * - **Mobile (<640px)**: filas multilínea (`MovimientoRow`) con **swipe** para
 *   eliminar y **scroll infinito** (IntersectionObserver sobre un centinela).
 * - **Desde 640px**: la tabla de siempre (`DataTable`), con un botón "Cargar más"
 *   cuando quedan movimientos.
 * - Las siguientes tandas se piden con una Server Action
 *   (`getHistorialMovimientosCuentaPaginaAction`), así que el cliente nunca
 *   recibe el historial completo de una.
 */
export function MovimientosCuentaClient({
  cuenta,
  primeraPagina,
  monedaPredeterminadaISO,
}: MovimientosCuentaClientProps) {
  const router = useRouter();
  const { go } = usePendingNav();

  // ⚠️ La primera tanda es SOLO la semilla: a partir del montaje la lista la
  // maneja el cliente (tandas acumuladas + recarga tras eliminar). No se
  // sincroniza con cambios posteriores de la prop a propósito: si no, cada
  // `router.refresh()` descartaría lo que el usuario ya cargó con el scroll.
  const [rows, setRows] = useState<HistorialMovimientoOut[]>(primeraPagina.rows);
  const [hayMas, setHayMas] = useState(primeraPagina.hayMas);
  const [cargando, setCargando] = useState(false);
  /** Movimiento seleccionado para confirmar su eliminación. */
  const [pendingAnular, setPendingAnular] =
    useState<HistorialMovimientoOut | null>(null);
  const [reverting, setReverting] = useState(false);
  /** Centinela del scroll infinito (mobile). */
  const centinelaRef = useRef<HTMLDivElement | null>(null);

  // Solo se muestra el equivalente cuando la moneda de la cuenta es DISTINTA a
  // la predeterminada (si coinciden son el mismo importe).
  const mostrarMonedaPredeterminada =
    cuenta.monedaISO !== monedaPredeterminadaISO;

  /** Pide la siguiente tanda y la agrega al final de la lista. */
  const cargarMas = useCallback(async () => {
    if (cargando || !hayMas) return;
    const offset = rows.length;
    setCargando(true);
    try {
      const pagina = await getHistorialMovimientosCuentaPaginaAction(
        cuenta.id,
        offset,
        PAGE
      );
      // Se agrega SOLO si la lista no cambió mientras viajaba el pedido (p. ej.
      // una recarga por eliminación): si no, se pisarían filas ya corregidas.
      setRows((prev) =>
        prev.length === offset ? [...prev, ...pagina.rows] : prev
      );
      setHayMas(pagina.hayMas);
    } catch {
      toast.error("No se pudieron cargar más movimientos");
    } finally {
      setCargando(false);
    }
  }, [cargando, hayMas, rows.length, cuenta.id]);

  // Scroll infinito (solo mobile: el centinela vive dentro del bloque `sm:hidden`).
  // El observer se rearma cuando cambia `cargarMas` (o sea, al terminar cada
  // tanda), así que si el centinela sigue a la vista encadena la próxima.
  useEffect(() => {
    const el = centinelaRef.current;
    if (!el || !hayMas) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) void cargarMas();
      },
      { rootMargin: `${PRELOAD_PX}px 0px` }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [cargarMas, hayMas]);

  /**
   * Vuelve a pedir TODO lo cargado. Se usa después de eliminar: al sacar un
   * movimiento cambian los **saldos corridos** de todos los movimientos más
   * viejos, así que no alcanza con quitar la fila de la lista.
   */
  const recargar = async () => {
    const cuantas = Math.min(100, Math.max(PAGE, rows.length));
    try {
      const pagina = await getHistorialMovimientosCuentaPaginaAction(
        cuenta.id,
        0,
        cuantas
      );
      setRows(pagina.rows);
      setHayMas(pagina.hayMas);
    } catch {
      /* si falla, se mantiene lo que ya estaba en pantalla */
    }
  };

  const handleAnular = async () => {
    if (!pendingAnular) return;
    setReverting(true);
    try {
      await anularMovimiento(pendingAnular.id);
      toast.success("Movimiento eliminado correctamente");
      setPendingAnular(null);
      await recargar();
      // Los saldos de la cuenta cambiaron: refresca el server (dashboard).
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo eliminar el movimiento"
      );
    } finally {
      setReverting(false);
    }
  };

  /** Acciones del swipe de una fila mobile: solo Eliminar, como el resto de la app. */
  const accionesFila = (rowId: string): SwipeRowAction[] | null => {
    const mov = rows.find((m) => m.id === rowId);
    if (!mov) return null;
    return [
      {
        key: "delete",
        label: "Eliminar",
        icon: Trash2,
        tone: "danger",
        onClick: () => setPendingAnular(mov),
      },
    ];
  };

  // Columnas de la tabla de escritorio: las MISMAS que mostraba el popup.
  const columnaMonedaPredeterminada: ColumnDef<HistorialMovimientoOut>[] = [
    {
      accessorKey: "montoPredeterminada",
      header: "En tu moneda",
      meta: { align: "right" } as const,
      cell: ({ getValue }) => (
        <span className="text-subtitle">
          {numberToCurrency(
            Number(getValue<number>() ?? 0),
            monedaPredeterminadaISO
          )}
        </span>
      ),
    },
  ];

  const columns: ColumnDef<HistorialMovimientoOut>[] = [
    {
      accessorKey: "fecha",
      header: "Fecha",
      cell: ({ getValue }) => dateTimeToString(getValue<Date | string>()),
    },
    {
      accessorKey: "motivo",
      header: "Motivo",
      cell: ({ getValue }) => (
        <span className="text-card-foreground">{String(getValue())}</span>
      ),
    },
    {
      accessorKey: "monto",
      header: "Monto",
      meta: { align: "right" } as const,
      cell: ({ row }) => {
        const monto = Number(row.original.monto);
        const esEgreso =
          (row.original.categoria ?? "").toLowerCase() === "egreso";
        return (
          <span
            className={cn(
              "font-medium",
              esEgreso ? "text-danger" : "text-success"
            )}
          >
            {numberToCurrency(
              esEgreso ? -Math.abs(monto) : Math.abs(monto),
              cuenta.monedaISO
            )}
          </span>
        );
      },
    },
    ...(mostrarMonedaPredeterminada ? columnaMonedaPredeterminada : []),
    {
      accessorKey: "saldoPosterior",
      header: "Saldo",
      meta: { align: "right" } as const,
      cell: ({ getValue }) =>
        numberToCurrency(Number(getValue<number>() ?? 0), cuenta.monedaISO),
    },
    {
      id: "actions",
      header: "",
      meta: { align: "center" } as const,
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => setPendingAnular(row.original)}
            disabled={reverting}
            className="rounded p-1 text-subtitle transition-colors hover:bg-muted hover:text-danger"
            aria-label="Eliminar movimiento"
            title="Eliminar movimiento"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    } as ColumnDef<HistorialMovimientoOut>,
  ];

  return (
    <div className="mx-auto max-w-5xl pb-8 pt-4 lg:pt-0">
      {/* Encabezado: volver + nombre de la cuenta (único punto de entrada: la
          tarjeta del dashboard). */}
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
          {cuenta.nombre}
        </h1>
      </div>

      {/* Resumen: el mismo dato que mostraba el recuadro del popup. */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted px-3 py-2">
        <p className="text-[13px] font-medium text-header">Saldo actual</p>
        <p className="text-[18px] font-semibold tracking-tight text-value">
          {numberToCurrency(cuenta.saldo, cuenta.monedaISO)}
        </p>
      </div>

      <h2 className="mb-2 mt-5 text-[16px] font-semibold text-header">
        Movimientos
      </h2>

      {rows.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-[13px] text-subtitle">
          Sin datos disponibles
        </div>
      ) : (
        <>
          {/* ── MOBILE (<sm): filas multilínea + swipe + scroll infinito ── */}
          <div className="sm:hidden">
            <SwipeRowActions actionsFor={accionesFila}>
              {/* `overflow-hidden` recorta la fila cuando se corre para
                  revelar las acciones. */}
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <ul>
                  {rows.map((m) => (
                    <MovimientoRow
                      key={m.id}
                      movimiento={m}
                      monedaISO={cuenta.monedaISO}
                      monedaPredeterminadaISO={monedaPredeterminadaISO}
                      mostrarEquivalente={mostrarMonedaPredeterminada}
                    />
                  ))}
                </ul>
              </div>
            </SwipeRowActions>
            {/* Centinela: al entrar en pantalla (con `PRELOAD_PX` de margen) se
                pide la tanda siguiente. */}
            <div ref={centinelaRef} aria-hidden="true" className="h-px" />
            {hayMas && cargando && (
              <p className="flex items-center justify-center gap-2 py-3 text-[12px] text-subtitle">
                <NavSpinner className="text-primary" />
                Cargando más movimientos…
              </p>
            )}
          </div>

          {/* ── Desde sm (640px): la tabla de siempre ── */}
          <div className="hidden sm:block">
            <div className="rounded-lg border border-border bg-card p-4">
              <DataTable columns={columns} data={rows} pageSize={PAGE} />
            </div>
            {hayMas && (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => void cargarMas()}
                  disabled={cargando}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-[13px] font-medium text-card-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {cargando && <NavSpinner className="text-primary" />}
                  Cargar más movimientos
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Confirmación de eliminación (mismo diálogo que tenía el popup) */}
      <Modal
        open={pendingAnular !== null}
        onClose={() => setPendingAnular(null)}
        title="Eliminar movimiento"
        className="sm:max-w-md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingAnular(null)}
              disabled={reverting}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-subtitle transition-colors hover:bg-muted hover:text-header"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAnular}
              disabled={reverting}
              className="rounded-lg bg-danger px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {reverting ? "Eliminando..." : "Eliminar"}
            </button>
          </div>
        }
      >
        {pendingAnular && (
          <div className="space-y-2">
            <p className="text-[13px] text-card-foreground">
              Se eliminará el movimiento y se ajustará el saldo de la cuenta.
              Esta acción no se puede deshacer.
            </p>
            <div className="space-y-1.5 rounded-lg border border-border bg-muted p-3 text-[13px]">
              <div className="flex justify-between gap-3">
                <span className="text-subtitle">Fecha</span>
                <span className="font-medium text-card-foreground">
                  {dateTimeToString(pendingAnular.fecha)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-subtitle">Motivo</span>
                <span className="font-medium text-card-foreground">
                  {pendingAnular.motivo}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-subtitle">Monto</span>
                <span
                  className={cn(
                    "font-semibold",
                    (pendingAnular.categoria ?? "").toLowerCase() === "egreso"
                      ? "text-danger"
                      : "text-success"
                  )}
                >
                  {numberToCurrency(
                    (pendingAnular.categoria ?? "").toLowerCase() === "egreso"
                      ? -Math.abs(Number(pendingAnular.monto))
                      : Math.abs(Number(pendingAnular.monto)),
                    cuenta.monedaISO
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
