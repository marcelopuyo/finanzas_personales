"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { NavSpinner } from "@/components/ui/nav-progress";
import type {
  ItemPendienteOut,
  LiquidacionOut,
} from "@/backend/src/queries/trabajos";
import { cn, decimalToTime, isoADdMmAa, numberToCurrency } from "@/lib/utils";
import { SIN_TRABAJO } from "@/lib/filtros-dashboard";
import { etiquetaConteoItems } from "@/lib/trabajo-texto";
import { getLiquidacionesCobradasPaginaAction } from "../actions";

/** Filas por tanda del scroll infinito (el backend acota el valor a 1..100). */
const PAGE = 20;
/** Margen con el que se dispara la carga anticipada del scroll infinito (px). */
const PRELOAD_PX = 240;

const pad = (n: number) => String(n).padStart(2, "0");

/** "dd-mm" de una fecha del backend (columnas `date`: medianoche UTC). */
function diaMes(v: Date | string): string {
  const iso =
    v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
  const [, m, d] = iso.split("-");
  return `${d}-${m}`;
}

/** "dd-mm" del instante de cobro (LOCAL: es un `timestamptz`). */
function diaMesLocal(v: Date | string | null): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1901) return "";
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}`;
}

/** "YYYY-MM-DD" de una fecha del backend (para ordenar). */
function isoFecha(v: Date | string): string {
  return v instanceof Date
    ? v.toISOString().slice(0, 10)
    : String(v).slice(0, 10);
}

/** Rango de fechas de un grupo pendiente: "20-09" o "24-09 → 26-09". */
function rangoPendiente(fechas: string[]): string {
  const ordenadas = [...fechas].sort();
  const desde = ordenadas[0];
  const hasta = ordenadas[ordenadas.length - 1];
  if (desde === hasta) return diaMes(desde);
  const anioDesde = desde.slice(2, 4);
  const anioHasta = hasta.slice(2, 4);
  return anioDesde === anioHasta
    ? `${diaMes(desde)} → ${diaMes(hasta)}`
    : `${diaMes(desde)}-${anioDesde} → ${diaMes(hasta)}-${anioHasta}`;
}

/** Rango de una liquidación: "25-09" si el período empieza y termina el mismo día. */
function rangoCobrado(p: LiquidacionOut): string {
  const desde = diaMes(p.fechaDesde);
  const hasta = diaMes(p.fechaHasta);
  return desde === hasta ? desde : `${desde} → ${hasta}`;
}

/** "3 jornadas", "1 tarea" o "1 jornada y 2 tareas" (etiqueta compartida). */
function conteo(lista: ItemPendienteOut[]): string {
  const jornadas = lista.filter((i) => i.tipo === "jornada").length;
  return etiquetaConteoItems(jornadas, lista.length - jornadas);
}

/** "HH:MM" de una hora decimal del backend (`HH.MM`, ej. 17.3 = 17:30). */
function hora(decimal: number | null): string {
  if (decimal == null) return "";
  return decimalToTime(decimal);
}

/** Detalle de un ítem: horas de la jornada o descripción/horas de la tarea. */
function detalleItem(i: ItemPendienteOut): string {
  if (i.tipo === "jornada") {
    return i.horaDesde != null && i.horaHasta != null
      ? `${hora(i.horaDesde)} a ${hora(i.horaHasta)}`
      : "Jornada";
  }
  const desc = i.descripcion?.trim();
  if (desc) return i.horas ? `${desc} · ${i.horas} h` : desc;
  return i.horas ? `Tarea · ${i.horas} h` : "Tarea";
}

/**
 * Fila de la grilla de `/trabajo`: **un solo formato** para las dos cosas que
 * muestra la pantalla (decisión del usuario 2026-09-26):
 *
 *  · **Pendiente** (un trabajo con jornadas/tareas sin liquidar) — el monto va
 *    **en verde** (plata sin cobrar).
 *  · **Cobrado** (una liquidación) — el monto va **en blanco**.
 *
 * El diseño de fila es el mismo en los dos casos (título + monto, subtítulo de
 * fechas, chevron) y **no es una tarjeta**: filas separadas por una línea dentro
 * de un único panel. Al abrir, la fila despliega sus ítems: en las pendientes
 * con **Editar / Eliminar** (no están congeladas), en las cobradas **sólo
 * lectura** (un ítem liquidado se corrige anulando el cobro y recobrando).
 *
 * - **Los pendientes van SIEMPRE ARRIBA** (pedido del usuario 2026-09-26),
 *   ordenados por la fecha de su ítem más reciente; debajo, las cobradas en el
 *   orden que devuelve el server (fecha de cobro DESC). No se mezclan.
 * - **Scroll infinito** (2026-09-26): la primera tanda de cobradas llega del
 *   server y las siguientes se piden al scrollear (IntersectionObserver sobre un
 *   centinela, mismo patrón que `/cuentas/[id]`), con un botón "Cargar más" de
 *   respaldo. No hay paginador.
 */
/**
 * **Fecha estimada de cobro** de un trabajo (2026-10-02). Reemplaza al chip de
 * ventana ("Por cobrar / En curso / Sin período"): la clasificación sigue
 * deduciéndose de la fecha, pero mostrando **cuándo** cierra o venció la ventana.
 *
 * - `enCurso` ⇒ la ventana todavía está abierta ⇒ `"cobro estimado dd-mm-aa"`
 *   (**ámbar**, mismo lenguaje del antiguo chip "En curso").
 * - `porCobrar` ⇒ la ventana ya cerró (cobrable ahora) ⇒ `"venció el dd-mm-aa"`
 *   (**verde**).
 *
 * La calcula `useVentanasCobro` (con la fecha **local** del navegador) a partir de
 * `lib/cobros-estimados.ts`. Los trabajos **sin cadencia** no tienen fecha ⇒ no se
 * muestra nada (opción A, decisión del usuario).
 */
export interface FechaCobroEstimada {
  tipo: "enCurso" | "porCobrar";
  /** Fin de la ventana estimada ("YYYY-MM-DD"). */
  cierre: string;
}

type Fila =
  | {
      tipo: "pendiente";
      key: string;
      titulo: string;
      subtitulo: string;
      monto: number;
      refFecha: string;
      lista: ItemPendienteOut[];
      /** Fecha estimada de cobro (reemplaza al chip de ventana). */
      fecha?: FechaCobroEstimada;
    }
  | {
      tipo: "cobrado";
      key: string;
      titulo: string;
      subtitulo: string;
      monto: number;
      refFecha: string;
      liquidacion: LiquidacionOut;
    };

export function PeriodosGrid({
  pendientes,
  cobradosIniciales,
  hayMasCobrados,
  currency,
  fechasCobro,
  onEditar,
  onEliminar,
  encabezado,
  filtroTrabajos,
  onTotalCobrados,
}: {
  pendientes: ItemPendienteOut[];
  /** Primera tanda de cobradas, ya resuelta en el server (la pantalla abre con datos). */
  cobradosIniciales: LiquidacionOut[];
  /** ¿Quedan más tandas de cobradas? (lo resuelve el server). */
  hayMasCobrados: boolean;
  /** ISO 4217 de la moneda predeterminada del usuario. */
  currency: string;
  /** **Fecha estimada de cobro por trabajo** (clave = nombre del trabajo). */
  fechasCobro?: Record<string, FechaCobroEstimada>;
  /** Abre el formulario de edición de un ítem pendiente. */
  onEditar?: (item: ItemPendienteOut) => void;
  /** Pide confirmación para eliminar un ítem pendiente. */
  onEliminar?: (item: ItemPendienteOut) => void;
  /**
   * **Encabezado de la sección**, pintado **dentro** de este panel (2026-10-03):
   * lleva el título + el ⋯ y el resumen de tandas. Antes iban **fuera** del
   * recuadro, con el título flotando sobre el fondo.
   */
  encabezado?: ReactNode;
  /**
   * **Filtro por trabajo** (2026-10-03): el listado respeta el mismo filtro que el
   * gráfico del panel de Ingresos (**sin** las fechas). Los **pendientes** ya
   * llegan filtrados; las **cobradas** se piden con el filtro al server, así que al
   * cambiar se **reinicia** la lista (la primera tanda del server viene sin filtrar).
   */
  filtroTrabajos?: string[];
  /** Avisa el total de cobradas **con el filtro vigente** (lo muestra el resumen). */
  onTotalCobrados?: (total: number) => void;
}) {
  // Fila abierta (por `key`): el desglose se muestra de a una.
  const [abierta, setAbierta] = useState<string | null>(null);
  // ⚠️ La primera tanda de cobradas es SOLO la semilla: a partir del montaje la
  // lista la maneja el cliente (tandas acumuladas con el scroll). No se
  // sincroniza con cambios posteriores de la prop a propósito: si no, cada
  // `router.refresh()` descartaría lo que el usuario ya cargó scrolleando.
  const [cobrados, setCobrados] = useState<LiquidacionOut[]>(cobradosIniciales);
  const [hayMas, setHayMas] = useState(hayMasCobrados);
  const [cargando, setCargando] = useState(false);
  /** Centinela del scroll infinito. */
  const centinelaRef = useRef<HTMLDivElement | null>(null);
  /** Clave del filtro con el que se cargó `cobrados` ("" = sin filtro). */
  const [filtroCargado, setFiltroCargado] = useState("");
  const filtroKey = JSON.stringify(filtroTrabajos ?? []);
  /** ¿La lista cargada quedó de un filtro anterior? (mientras sí, no se pagina). */
  const listaVieja = filtroCargado !== filtroKey;
  /** Filtro vigente para los pedidos (y callback del total, sin re-crear `cargar`). */
  const filtroRef = useRef<string[]>(filtroTrabajos ?? []);
  const totalRef = useRef(onTotalCobrados);
  useEffect(() => {
    totalRef.current = onTotalCobrados;
  }, [onTotalCobrados]);

  /**
   * Pide una tanda de cobradas con el **filtro vigente**. `offset = 0` reemplaza la
   * lista (se usa al cambiar el filtro: la tanda inicial del server viene sin filtrar).
   */
  const cargar = useCallback(async (offset: number) => {
    const filtro = filtroRef.current;
    setCargando(true);
    try {
      const pagina = await getLiquidacionesCobradasPaginaAction(
        offset,
        PAGE,
        filtro
      );
      setCobrados((prev) =>
        offset === 0
          ? pagina.filas
          : prev.length === offset
            ? [...prev, ...pagina.filas]
            : prev
      );
      setHayMas(pagina.hayMas);
      setFiltroCargado(JSON.stringify(filtro));
      totalRef.current?.(pagina.total);
    } catch {
      toast.error("No se pudieron cargar más períodos");
    } finally {
      setCargando(false);
    }
  }, []);

  /** Pide la siguiente tanda y la agrega al final de la lista. */
  const cargarMas = useCallback(async () => {
    // Con una lista de otro filtro el `offset` no sirve: se espera la recarga.
    if (cargando || !hayMas || listaVieja) return;
    await cargar(cobrados.length);
  }, [cargando, hayMas, listaVieja, cobrados.length, cargar]);

  /**
   * **Cambio de filtro** (2026-10-03): se recarga desde cero con el filtro nuevo.
   * ⚠️ El pedido va dentro de un `setTimeout` —no en el cuerpo del efecto— porque
   * `cargar` hace `setState` (regla de lint de la app: nada de `setState` sincrónico
   * en un efecto); además así se cancela si el filtro vuelve a cambiar enseguida.
   */
  useEffect(() => {
    if (filtroCargado === filtroKey) return;
    const t = setTimeout(() => {
      filtroRef.current = filtroTrabajos ?? [];
      void cargar(0);
    }, 0);
    return () => clearTimeout(t);
  }, [filtroKey, filtroTrabajos, filtroCargado, cargar]);

  // El observer se rearma al terminar cada tanda (cambia `cargarMas`), así que si
  // el centinela sigue a la vista encadena la próxima tanda.
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

  // ── Filas: PRIMERO los pendientes (por trabajo), después las cobradas ──
  const filasPendientes: Fila[] = [];
  const grupos = new Map<string, ItemPendienteOut[]>();
  for (const i of pendientes) {
    const nombre = i.trabajoNombre || "Sin trabajo";
    const lista = grupos.get(nombre);
    if (lista) lista.push(i);
    else grupos.set(nombre, [i]);
  }
  for (const [trabajo, lista] of grupos.entries()) {
    const fechas = lista.map((i) => i.fecha).sort();
    filasPendientes.push({
      tipo: "pendiente",
      key: `p:${trabajo}`,
      titulo: trabajo,
      fecha: fechasCobro?.[trabajo],
      subtitulo: `${conteo(lista)} · ${rangoPendiente(fechas)}`,
      monto: lista.reduce((acc, i) => acc + (i.monto || 0), 0),
      // La fecha más reciente del grupo ordena a los pendientes entre sí.
      refFecha: fechas[fechas.length - 1],
      lista,
    });
  }
  // Lo más reciente arriba DENTRO de los pendientes (los cobrados ya vienen
  // ordenados por fecha de cobro DESC desde la consulta).
  filasPendientes.sort((a, b) =>
    a.refFecha < b.refFecha ? 1 : a.refFecha > b.refFecha ? -1 : 0
  );
  /**
   * Cobradas a mostrar: si la lista quedó de un **filtro anterior** (mientras llega
   * la primera tanda filtrada) se acota en memoria, así no se ven filas que el
   * filtro nuevo excluye. El server reconcilia enseguida con la página 0.
   */
  const cobradosVisibles = listaVieja
    ? cobrados.filter(
        (p) =>
          !filtroTrabajos?.length ||
          filtroTrabajos.includes(p.trabajo?.nombre ?? SIN_TRABAJO)
      )
    : cobrados;
  const filas: Fila[] = [
    ...filasPendientes,
    ...cobradosVisibles.map((p): Fila => {
      // El importe de la fila es lo COBRADO. El `montoCalculado` —lo que
      // correspondía— ya NO se muestra (2026-09-27, pedido del usuario: se quitó
      // la línea "calc. …" que salía en los cobros parciales); queda sólo como
      // respaldo si faltara el cobrado.
      const monto = p.montoCobrado ?? p.montoCalculado ?? 0;
      const fechaCobro = diaMesLocal(p.fechaDeCobro);
      return {
        tipo: "cobrado",
        key: `c:${p.id}`,
        titulo: p.trabajo?.nombre ?? "Sin trabajo",
        subtitulo: `${rangoCobrado(p)}${fechaCobro ? ` · cobrado ${fechaCobro}` : ""}`,
        monto,
        refFecha: isoFecha(p.fechaDeCobro ?? p.fechaHasta),
        liquidacion: p,
      };
    }),
  ];

  return (
    <>
      <div className="rounded-2xl border border-border bg-card px-3">
        {encabezado}
        {filas.map((f) => {
          const isAbierta = abierta === f.key;
          return (
            <div key={f.key} className="border-b border-border last:border-b-0">
              <button
                type="button"
                onClick={() => setAbierta(isAbierta ? null : f.key)}
                aria-expanded={isAbierta}
                className="flex w-full items-start gap-2.5 py-2.5 text-left [-webkit-tap-highlight-color:transparent]"
              >
                <span className="min-w-0 flex-1">
                  {/* Título + la **fecha estimada de cobro**: dice cuándo cierra
                      la ventana (ámbar) o cuándo venció (verde). Reemplaza al
                      chip de ventana (2026-10-02). */}
                  <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span className="text-[13.5px] break-words text-header">
                      {f.titulo}
                    </span>
                    {f.tipo === "pendiente" && f.fecha && (
                      <span
                        className={cn(
                          "shrink-0 text-[10.5px] font-medium whitespace-nowrap",
                          f.fecha.tipo === "enCurso"
                            ? "text-warning"
                            : "text-success"
                        )}
                      >
                        {f.fecha.tipo === "enCurso"
                          ? "cobro estimado "
                          : "venció el "}
                        {isoADdMmAa(f.fecha.cierre)}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-[15px] text-subtitle">
                    {f.subtitulo}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {/* Verde = falta cobrar · blanco = ya cobrado. Es la ÚNICA
                      diferencia estética entre las dos clases de fila. */}
                  <span
                    className={cn(
                      "block text-[14.5px] tabular-nums",
                      f.tipo === "pendiente" ? "text-success" : "text-value"
                    )}
                  >
                    {numberToCurrency(f.monto, currency)}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 text-subtitle transition-transform",
                    isAbierta && "rotate-180"
                  )}
                />
              </button>

              {isAbierta && (
                <div className="pb-2.5 pl-3">
                  {f.tipo === "pendiente" ? (
                    f.lista.map((i) => (
                      <div key={i.id} className="flex items-start gap-2 py-1.5">
                        <p className="min-w-0 flex-1 text-[12px] leading-4 break-words text-card-foreground">
                          <span className="tabular-nums text-subtitle">
                            {diaMes(i.fecha)}
                          </span>
                          {" · "}
                          {detalleItem(i)}
                          {i.montoPropina > 0 && (
                            <span className="block text-[11px] leading-4 text-success">
                              propina {numberToCurrency(i.montoPropina, currency)}
                            </span>
                          )}
                        </p>
                        <span className="shrink-0 text-[12.5px] tabular-nums text-success">
                          {numberToCurrency(i.monto || 0, currency)}
                        </span>
                        <div className="flex shrink-0 items-center gap-0.5">
                          {onEditar && (
                            <button
                              type="button"
                              onClick={() => onEditar(i)}
                              aria-label="Editar"
                              title="Editar"
                              className="rounded-lg p-1.5 text-subtitle transition-colors hover:bg-muted hover:text-header"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {onEliminar && (
                            <button
                              type="button"
                              onClick={() => onEliminar(i)}
                              aria-label="Eliminar"
                              title="Eliminar"
                              className="rounded-lg p-1.5 text-subtitle transition-colors hover:bg-muted hover:text-danger"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <>
                      {(() => {
                        const items = [
                          ...f.liquidacion.jornadas.map((j) => ({
                            id: `j-${j.id}`,
                            detalle: `${diaMes(j.fechaJornada)} · ${decimalToTime(
                              j.horaDesde
                            )} a ${decimalToTime(j.horaHasta)}`,
                            monto: j.montoJornada ?? 0,
                            propina: j.montoPropina ?? 0,
                          })),
                          ...f.liquidacion.tareas.map((t) => ({
                            id: `t-${t.id}`,
                            detalle: `${diaMes(t.fechaTarea)} · ${
                              t.descripcion?.trim() || "Tarea"
                            }${t.horasTarea ? ` · ${t.horasTarea} h` : ""}`,
                            monto: t.montoTarea ?? 0,
                            propina: 0,
                          })),
                        ];
                        if (items.length === 0) {
                          return (
                            <p className="py-1.5 text-[11.5px] leading-4 text-subtitle">
                              Esta modalidad no carga jornadas ni tareas: el
                              rango y el monto se declaran al cobrar.
                            </p>
                          );
                        }
                        return items.map((i) => (
                          <div key={i.id} className="flex items-start gap-2 py-1.5">
                            <p className="min-w-0 flex-1 text-[12px] leading-4 break-words text-card-foreground">
                              {i.detalle}
                              {i.propina > 0 && (
                                <span className="block text-[11px] leading-4 text-success">
                                  propina {numberToCurrency(i.propina, currency)}
                                </span>
                              )}
                            </p>
                            <span className="shrink-0 text-[12.5px] tabular-nums text-value">
                              {numberToCurrency(i.monto, currency)}
                            </span>
                          </div>
                        ));
                      })()}
                      <p className="mt-1.5 text-[11px] leading-4 text-subtitle">
                        Los ítems de una liquidación están congelados: para
                        corregirlos hay que anular el cobro y volver a cobrar.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Centinela del scroll infinito: al entrar en pantalla (con `PRELOAD_PX`
          de margen) se pide la tanda siguiente de cobradas. Con una lista de otro
          filtro (`listaVieja`) no se pagina: se espera la recarga con el nuevo. */}
      <div ref={centinelaRef} aria-hidden="true" className="h-px" />
      {hayMas && cargando && !listaVieja && (
        <div className="flex justify-center py-3">
          <p className="flex items-center gap-2 text-[12px] text-subtitle">
            <NavSpinner className="text-primary" />
            Cargando más períodos…
          </p>
        </div>
      )}
      {hayMas && !cargando && !listaVieja && (
        <div className="flex justify-center py-3">
          {/* Respaldo para teclado / pantallas donde el centinela ya está
              visible sin scrollear. */}
          <button
            type="button"
            onClick={() => void cargarMas()}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-[13px] font-medium text-card-foreground transition-colors hover:bg-muted"
          >
            Cargar más períodos
          </button>
        </div>
      )}
    </>
  );
}
