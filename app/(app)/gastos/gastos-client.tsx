"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { DataTable } from "@/components/ui/data-table";
import { NavSpinner, usePendingNav } from "@/components/ui/nav-progress";
import {
  SwipeRowActions,
  type SwipeRowAction,
} from "@/components/crud/SwipeRowActions";
import { getGastosPaginaAction } from "@/backend/src/actions/gastos-pagina";
import { eliminarGasto } from "@/backend/src/actions/gastos";
import type { GastoOut, GastosPagina } from "@/backend/src/queries/gastos";
import { cn, dateTimeToString, numberToCurrency } from "@/lib/utils";
import { invalidarHistoriales } from "@/lib/historial-cuentas";
import { useTap } from "@/lib/tap";
import { GastoRow } from "./gasto-row";

/** Filas por tanda del scroll infinito (el backend acota el valor a 1..100). */
const PAGE = 20;
/** Margen con el que se dispara la carga anticipada del scroll infinito (px). */
const PRELOAD_PX = 240;
/** Retardo de la búsqueda (se cancela si el usuario sigue escribiendo). */
const DEBOUNCE_MS = 350;

interface GastosClientProps {
  /** Primera tanda, ya resuelta en el server: la pantalla abre con datos. */
  primeraPagina: GastosPagina;
  /** ISO de la moneda predeterminada del usuario (en la que está `gasto.monto`). */
  monedaISO: string;
  /**
   * **Modo embebido** (2026-10-03, rama `rediseno-ui`): la pantalla de **Gastos**
   * del dashboard muestra esta misma lista **como su segundo panel** —todos los
   * gastos, con búsqueda y scroll infinito— en vez de las tarjetas de los últimos
   * 3 días. Se omite la cabecera (volver + título) y el padding de pantalla;
   * **no lleva título** (pedido del usuario).
   */
  embebido?: boolean;
  /**
   * **Filtros del panel** (2026-10-03): el listado respeta los **mismos** filtros
   * que los gráficos del dashboard —categoría y cuenta—, **menos las fechas**: el
   * listado muestra todo el historial. Llegan tal como los muestra la UI (con los
   * rótulos "Sin categoría" / "Sin cuenta").
   */
  filtros?: { categorias?: string[]; cuentas?: string[] };
}

/**
 * Pantalla **`/gastos`** — TODOS los gastos, con búsqueda y scroll infinito
 * (2026-09-30). Desde el 2026-10-03 **la misma lista se embebe como segundo panel
 * de la pantalla Gastos** del dashboard (`embebido`, sin título): así esa pantalla
 * tiene la **misma resolución** que Ingresos (que lista todos los períodos).
 *
 * - **Mobile (<640px)**: filas multilínea (`GastoRow`) con **swipe para eliminar**
 *   (con confirmación) y **scroll infinito** (IntersectionObserver + centinela).
 * - **Desde 640px**: la tabla, con un botón "Cargar más" cuando quedan gastos.
 * - **Búsqueda**: campo arriba de todo; se aplica sola ~350 ms después de dejar de
 *   escribir (o al instante con Enter) y la resuelve el **server** (descripción ·
 *   categoría · cuenta), así nunca se trae la lista completa.
 * - Las siguientes tandas se piden con `getGastosPaginaAction`.
 *
 * ⚠️ **Eliminar** llama a `eliminarGasto`, el **mismo** camino que usaba el CRUD de
 * gastos: revierte cada pago en la cuenta (saldo + histórico) y hace soft-delete
 * del gasto y sus movimientos ⇒ el efecto es el mismo que eliminar el movimiento
 * desde la pantalla de una cuenta.
 */
export function GastosClient({
  primeraPagina,
  monedaISO,
  embebido = false,
  filtros,
}: GastosClientProps) {
  const router = useRouter();
  const { go } = usePendingNav();

  // ⚠️ La primera tanda es SOLO la semilla: a partir del montaje la lista la
  // maneja el cliente (tandas acumuladas + búsqueda). No se sincroniza con
  // cambios posteriores de la prop a propósito: un `router.refresh()` no debe
  // descartar lo que el usuario ya cargó con el scroll.
  const [rows, setRows] = useState<GastoOut[]>(primeraPagina.rows);
  const [total, setTotal] = useState(primeraPagina.total);
  const [hayMas, setHayMas] = useState(primeraPagina.hayMas);
  const [cargando, setCargando] = useState(false);
  /** Texto del campo de búsqueda (lo que el usuario está escribiendo). */
  const [busqueda, setBusqueda] = useState("");
  /** Término APLICADO (el que devolvieron las filas que están en pantalla). */
  const [aplicada, setAplicada] = useState("");
  /** Gasto seleccionado para confirmar su eliminación. */
  const [pendiente, setPendiente] = useState<GastoOut | null>(null);
  const [eliminando, setEliminando] = useState(false);
  /** Centinela del scroll infinito (mobile). */
  const centinelaRef = useRef<HTMLDivElement | null>(null);
  /**
   * Filas ya PEDIDAS al server (no las que se ven): es el `offset` de la próxima
   * tanda. Se lleva aparte de `rows.length` porque eliminar una fila la saca de
   * la pantalla sin cambiar el offset real del server (si no, se repetiría una).
   */
  const traidasRef = useRef(primeraPagina.rows.length);
  /** Token del último pedido: descarta las respuestas que llegan tarde. */
  const pedidoRef = useRef(0);
  /** Término vigente para los callbacks (sin re-crearlos en cada tecla). */
  const aplicadaRef = useRef("");
  /** **Filtros vigentes** (categorías/cuentas del panel) para `cargar`. */
  const filtrosRef = useRef(filtros ?? {});
  /** Clave de los filtros ya aplicados (para no recargar al montar). */
  const filtrosAplicadosRef = useRef(JSON.stringify(filtros ?? {}));

  /** Pide una tanda (`offset` 0 = recargar desde el principio) y la aplica. */
  const cargar = useCallback(async (offset: number, termino: string) => {
    const token = ++pedidoRef.current;
    setCargando(true);
    try {
      const pagina = await getGastosPaginaAction(
        offset,
        PAGE,
        termino,
        filtrosRef.current
      );
      // Llegó tarde (el usuario ya buscó otra cosa): se descarta.
      if (token !== pedidoRef.current) return;
      setRows((prev) => (offset === 0 ? pagina.rows : [...prev, ...pagina.rows]));
      setTotal(pagina.total);
      setHayMas(pagina.hayMas);
      traidasRef.current = offset + pagina.rows.length;
    } catch {
      if (token === pedidoRef.current) {
        toast.error("No se pudieron cargar los gastos");
      }
    } finally {
      if (token === pedidoRef.current) setCargando(false);
    }
  }, []);

  /**
   * Búsqueda: se aplica sola tras un pequeño retardo (y al instante con Enter).
   * El `setState` va DENTRO del `setTimeout`, nunca sincrónico en el efecto.
   */
  useEffect(() => {
    const q = busqueda.trim();
    if (q === aplicadaRef.current) return;
    const t = setTimeout(() => {
      aplicadaRef.current = q;
      setAplicada(q);
      void cargar(0, q);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [busqueda, cargar]);

  /**
   * **Filtros del panel** (2026-10-03, pantalla Gastos del dashboard): cuando el
   * usuario cambia las categorías o las cuentas, el listado se recarga desde el
   * principio — el `offset` anterior ya no sirve con otro filtro.
   * ⚠️ Las **fechas** no entran: son solo de los gráficos.
   */
  const filtrosKey = JSON.stringify(filtros ?? {});
  useEffect(() => {
    if (filtrosKey === filtrosAplicadosRef.current) return;
    filtrosAplicadosRef.current = filtrosKey;
    filtrosRef.current = filtros ?? {};
    void cargar(0, aplicadaRef.current);
  }, [filtrosKey, filtros, cargar]);

  /** Aplica la búsqueda YA (Enter, o el "Limpiar" del campo). */
  const aplicarYa = (texto: string) => {
    const q = texto.trim();
    if (q === aplicadaRef.current) return;
    aplicadaRef.current = q;
    setAplicada(q);
    void cargar(0, q);
  };

  /** Siguiente tanda (scroll infinito y botón "Cargar más" de desktop). */
  const cargarMas = useCallback(async () => {
    if (cargando || !hayMas) return;
    await cargar(traidasRef.current, aplicadaRef.current);
  }, [cargando, hayMas, cargar]);

  // Scroll infinito (solo mobile: el centinela vive dentro del bloque `sm:hidden`).
  // El observer se rearma al terminar cada tanda, así que si el centinela sigue a
  // la vista encadena la próxima.
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

  const limpiarBusqueda = () => {
    setBusqueda("");
    aplicarYa("");
  };
  // ⚠️ `useTap` (touch events + click), NO `onClick`: en iOS el toque de una zona
  // chica puede no generar `click` (lección §119).
  const tapLimpiar = useTap(limpiarBusqueda);

  const handleEliminar = async () => {
    if (!pendiente) return;
    const id = pendiente.id;
    setEliminando(true);
    try {
      await eliminarGasto(id);
      toast.success("Gasto eliminado correctamente");
      // Se saca la fila sin re-paginar: `traidasRef` conserva el offset real.
      setRows((prev) => prev.filter((g) => g.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      setPendiente(null);
      // El gasto revertido tocó saldos de cuentas: descarta la 1ª página cacheada
      // del carrusel de Inicio (no se conoce la cuenta acá ⇒ se invalidan todas).
      invalidarHistoriales();
      // Los saldos de las cuentas cambiaron: refresca los datos del server.
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo eliminar el gasto"
      );
    } finally {
      setEliminando(false);
    }
  };

  /** Acciones del swipe de una fila mobile: solo Eliminar, como el resto de la app. */
  const accionesFila = (rowId: string): SwipeRowAction[] | null => {
    const gasto = rows.find((g) => g.id === rowId);
    if (!gasto) return null;
    return [
      {
        key: "delete",
        label: "Eliminar",
        icon: Trash2,
        tone: "danger",
        onClick: () => setPendiente(gasto),
      },
    ];
  };

  const columns: ColumnDef<GastoOut>[] = [
    {
      accessorKey: "fechaPago",
      header: "Pago",
      meta: { align: "center" } as const,
      cell: ({ row }) => (row.original.fechaPago ? dateTimeToString(row.original.fechaPago) : "—"),
    },
    {
      accessorKey: "descripcion",
      header: "Descripción",
      cell: ({ getValue }) => (getValue<string>() ? getValue<string>() : "-"),
    },
    {
      id: "categoria",
      accessorFn: (row) => row.categoria?.nombre ?? "",
      header: "Categoría",
      cell: ({ getValue }) => (getValue<string>() ? getValue<string>() : "Sin categoría"),
    },
    {
      accessorKey: "cuenta",
      header: "Cuenta",
      cell: ({ getValue }) => getValue<string | null>() || "—",
    },
    {
      accessorKey: "monto",
      header: "Importe",
      meta: { align: "right" } as const,
      cell: ({ getValue }) => numberToCurrency(Number(getValue<number>() ?? 0), monedaISO),
    },
    {
      id: "actions",
      header: "",
      meta: { align: "center" } as const,
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => setPendiente(row.original)}
            disabled={eliminando}
            className="rounded p-1 text-subtitle transition-colors hover:bg-muted hover:text-danger"
            aria-label="Eliminar gasto"
            title="Eliminar gasto"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    } as ColumnDef<GastoOut>,
  ];

  /**
   * **Campo de búsqueda** (se aplica solo ~350 ms después de dejar de escribir).
   * Se define acá porque se pinta en **dos lugares** según el modo: arriba de todo
   * en la pantalla `/gastos`, o **dentro del panel** del listado cuando va
   * embebido en la pantalla Gastos del dashboard (2026-10-03).
   */
  const campoBusqueda = (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtitle" />
      <input
        type="text"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") aplicarYa(busqueda);
          if (e.key === "Escape" && busqueda) limpiarBusqueda();
        }}
        placeholder="Buscar por descripción, categoría o cuenta..."
        aria-label="Buscar gasto"
        enterKeyHint="search"
        // En el panel el campo va con `bg-muted` (el panel ya es `bg-card`: si no,
        // el recuadro se confundiría con el fondo del panel).
        className={cn(
          "w-full rounded-full border border-border py-2 pl-9 pr-10 text-[13px] text-card-foreground placeholder:text-subtitle focus:outline-none focus:ring-2 focus:ring-primary/40",
          embebido ? "bg-muted" : "bg-card"
        )}
      />
      {busqueda.length > 0 && (
        <button
          type="button"
          {...tapLimpiar}
          aria-label="Limpiar búsqueda"
          title="Limpiar"
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-subtitle transition-colors hover:bg-muted hover:text-header"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  /** Contador de filas del listado (cuántas de cuántas). */
  const contadorGastos = (
    <p className="mb-2 mt-3 text-[12px] text-subtitle">
      {rows.length} de {total} gastos
    </p>
  );

  return (
    <div className={embebido ? undefined : "mx-auto max-w-5xl pb-8 pt-4 lg:pt-0"}>
      {/* Encabezado: volver (único punto de entrada: el Detalle de Gastos).
          En modo **embebido** (panel de la pantalla Gastos) no se pinta: el panel
          va **sin título** (2026-10-03). */}
      {!embebido && (
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
            Gastos
          </h1>
        </div>
      )}

      {/* Búsqueda: la resuelve el server. En la pantalla `/gastos` va arriba de
          todo; en el modo **embebido** viaja **dentro del panel** del listado
          (2026-10-03, pedido del usuario). */}
      {!embebido && campoBusqueda}
      {!embebido && contadorGastos}

      {rows.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-center text-[13px] text-subtitle">
          {aplicada
            ? "No hay gastos que coincidan con la búsqueda"
            : "Todavía no tenés gastos cargados"}
        </div>
      ) : (
        <>
          {/* ── MOBILE (<sm): filas multilínea + swipe + scroll infinito ── */}
          <div className="sm:hidden">
            <SwipeRowActions actionsFor={accionesFila}>
              {/* `overflow-hidden` recorta la fila cuando se corre para revelar
                  las acciones. */}
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                {embebido && (
                  <div className="px-3 pt-3">
                    {campoBusqueda}
                    {contadorGastos}
                  </div>
                )}
                <ul>
                  {rows.map((g) => (
                    <GastoRow key={g.id} gasto={g} monedaISO={monedaISO} />
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
                Cargando más gastos…
              </p>
            )}
          </div>

          {/* ── Desde sm (640px): la tabla ── */}
          <div className="hidden sm:block">
            <div className="rounded-lg border border-border bg-card p-4">
              {embebido && campoBusqueda}
              {embebido && contadorGastos}
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
                  Cargar más gastos
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Confirmación de eliminación (misma interacción que la pantalla de una
          cuenta al eliminar un movimiento). */}
      <Modal
        open={pendiente !== null}
        onClose={() => setPendiente(null)}
        title="Eliminar gasto"
        className="sm:max-w-md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendiente(null)}
              disabled={eliminando}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-subtitle transition-colors hover:bg-muted hover:text-header"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleEliminar}
              disabled={eliminando}
              className="rounded-lg bg-danger px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {eliminando ? "Eliminando..." : "Eliminar"}
            </button>
          </div>
        }
      >
        {pendiente && (
          <div className="space-y-2">
            <p className="text-[13px] text-card-foreground">
              Se eliminará el gasto y se revertirán sus pagos: el saldo de la
              cuenta vuelve atrás. Esta acción no se puede deshacer.
            </p>
            <div className="space-y-1.5 rounded-lg border border-border bg-muted p-3 text-[13px]">
              <div className="flex justify-between gap-3">
                <span className="text-subtitle">Descripción</span>
                <span className="truncate font-medium text-card-foreground">
                  {pendiente.descripcion || "Sin descripción"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-subtitle">Fecha</span>
                <span className="font-medium text-card-foreground">
                  {pendiente.fechaPago
                    ? dateTimeToString(pendiente.fechaPago)
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-subtitle">Monto</span>
                <span className="text-card-foreground">
                  {numberToCurrency(Number(pendiente.monto), monedaISO)}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
