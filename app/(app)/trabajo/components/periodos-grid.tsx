"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, FileDown, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { NavSpinner } from "@/components/ui/nav-progress";
import {
  SwipeRowActions,
  type SwipeRowAction,
} from "@/components/crud/SwipeRowActions";
import type {
  ItemPendienteOut,
  LiquidacionOut,
} from "@/backend/src/queries/trabajos";
import { cn, decimalToTime, numberToCurrency } from "@/lib/utils";
import type { RepartoPendientes } from "@/lib/cobros-estimados";
import { SIN_TRABAJO } from "@/lib/filtros-dashboard";
import { etiquetaConteoItems } from "@/lib/trabajo-texto";
import { Tabs } from "@/components/ui/tabs";
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
 * con **Editar / Eliminar mediante swipe** (no están congeladas), en las
 * cobradas **sólo lectura** (un ítem liquidado se corrige anulando el cobro y
 * recobrando).
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
 * **Ventana estimada** de una sección de pendientes (2026-10-02, ampliada el
 * 2026-10-07 con el "día de pago"). Reemplaza al chip de ventana ("Por cobrar / En
 * curso / Sin período"): la clasificación sigue deduciéndose de la fecha, pero
 * mostrando **cuándo** cerró o cierra la ventana **y cuándo se cobra**.
 *
 * - `enCurso` ⇒ la ventana todavía está abierta ⇒ `cierra el dd-mm-aa` (**ámbar**,
 *   mismo lenguaje del antiguo chip "En curso"). El **monto** de la fila va ámbar:
 *   es plata que todavía **no** se puede cobrar.
 * - `porCobrar` ⇒ la ventana ya cerró (cobrable ahora) ⇒ `cerró el dd-mm`
 *   (**verde**, y la fila también en verde).
 *
 * En los dos casos, si se pudo inferir el **"día de pago"** del trabajo
 * (`CadenciaTrabajo.pagoDias`, de sus cobros reales) se agrega un segundo chip
 * `pago ~dd-mm-aa` con la fecha estimada en la que **llega la plata** — que es
 * distinta del cierre del período (en Duffys, ~8 días después).
 *
 * La calcula `useVentanasCobro` (con la fecha **local** del navegador) a partir de
 * `lib/cobros-estimados.ts`. Los trabajos **sin cadencia** no tienen ventana ⇒ no se
 * muestra nada.
 */
export interface FechaCobroEstimada {
  tipo: "enCurso" | "porCobrar";
  /** Fin de la ventana estimada ("YYYY-MM-DD"). */
  cierre: string;
  /** Fecha estimada de **pago** ("" si no se pudo inferir el retraso). */
  pago: string;
}

/** Orden de las secciones dentro de un mismo trabajo (la cerrada va primero). */
type OrdenSeccion = 0 | 1 | 2;

type Fila =
  | {
      tipo: "pendiente";
      key: string;
      titulo: string;
      subtitulo: string;
      monto: number;
      refFecha: string;
      lista: ItemPendienteOut[];
      /** Ventana de la sección (sin ventana cuando el trabajo no tiene cadencia). */
      fecha?: FechaCobroEstimada;
      /** Sección de la fila: desempata el orden dentro del mismo trabajo. */
      orden: OrdenSeccion;
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

/** Fila de un **pendiente**: el orden por sección sólo aplica a estas. */
type FilaPendiente = Extract<Fila, { tipo: "pendiente" }>;

export function PeriodosGrid({
  secciones,
  cobradosIniciales,
  hayMasCobrados,
  currency,
  enCurso,
  porCobrar,
  onEditar,
  onEliminar,
  filtroTrabajos,
  onTotalCobrados,
}: {
  /**
   * **Pendientes repartidos en ventanas por trabajo** (lo calcula `useVentanasCobro`
   * sobre `lib/cobros-estimados.ts`): cada trabajo trae hasta **dos secciones**
   * —"por cobrar" (ventana cerrada) y "en curso" (abierta/futura)— y la lista pinta
   * **una fila por sección** (2026-10-07).
   *
   * ⚠️ Antes llegaba la lista **cruda** de ítems + **una sola** fecha por trabajo:
   * las dos ventanas de Duffys caían en la misma fila, con el rango de las dos
   * (`19-09 → 06-10`) y la fecha de la última (`16-10`) ⇒ no coincidía nada.
   */
  secciones: RepartoPendientes<ItemPendienteOut>[];
  /** Primera tanda de cobradas, ya resuelta en el server (la pantalla abre con datos). */
  cobradosIniciales: LiquidacionOut[];
  /** ¿Quedan más tandas de cobradas? (lo resuelve el server). */
  hayMasCobrados: boolean;
  /** ISO 4217 de la moneda predeterminada del usuario. */
  currency: string;
  /** Abre el formulario de edición de un ítem pendiente. */
  onEditar?: (item: ItemPendienteOut) => void;
  /** Pide confirmación para eliminar un ítem pendiente. */
  onEliminar?: (item: ItemPendienteOut) => void;
  /** Resumen de los ítems de la ventana en curso. */
  enCurso: { monto: number; items: number };
  /** Resumen de los ítems cuya ventana ya cerró. */
  porCobrar: { monto: number; items: number };
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
  const [pestana, setPestana] = useState("enCurso");
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
    if (pestana !== "cobrados") return;
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
  }, [cargarMas, hayMas, pestana]);

  const itemsPorSwipeId = new Map<string, ItemPendienteOut>();
  for (const seccion of secciones) {
    for (const item of [
      ...(seccion.porCobrar?.items ?? []),
      ...(seccion.enCurso?.items ?? []),
      ...seccion.sinPeriodo,
    ]) {
      itemsPorSwipeId.set(`${item.tipo}:${item.id}`, item);
    }
  }
  const accionesFila = (rowId: string): SwipeRowAction[] | null => {
    const item = itemsPorSwipeId.get(rowId);
    if (!item) return null;
    const acciones: SwipeRowAction[] = [];
    if (onEditar) {
      acciones.push({
        key: "edit",
        label: "Editar",
        icon: Pencil,
        size: "compact",
        onClick: () => onEditar(item),
      });
    }
    if (onEliminar) {
      acciones.push({
        key: "delete",
        label: "Eliminar",
        icon: Trash2,
        tone: "danger",
        size: "compact",
        onClick: () => onEliminar(item),
      });
    }
    return acciones.length ? acciones : null;
  };

  // ── Filas: PRIMERO los pendientes (**una por ventana** de cada trabajo),
  //    después las cobradas ──
  const filasPendientes: FilaPendiente[] = [];
  for (const r of secciones) {
    // Hasta **dos filas** por trabajo: la ventana **cerrada** ("cerró el", verde) y
    // la **abierta/futura** ("cobro estimado", ámbar). Los ítems sin ventana (trabajo
    // sin cadencia, o fechas que caen entre ventanas) van en una tercera fila **sin
    // chip**.
    const partes: {
      items: ItemPendienteOut[];
      orden: OrdenSeccion;
      fecha?: FechaCobroEstimada;
    }[] = [];
    if (r.porCobrar) {
      partes.push({
        items: r.porCobrar.items,
        orden: 0,
        fecha: {
          tipo: "porCobrar",
          cierre: r.porCobrar.cierre,
          pago: r.porCobrar.pago,
        },
      });
    }
    if (r.enCurso) {
      partes.push({
        items: r.enCurso.items,
        orden: 1,
        fecha: {
          tipo: "enCurso",
          cierre: r.enCurso.cierre,
          pago: r.enCurso.pago,
        },
      });
    }
    if (r.sinPeriodo.length) {
      partes.push({ items: r.sinPeriodo, orden: 2 });
    }
    for (const p of partes) {
      const fechas = p.items.map((i) => i.fecha).sort();
      filasPendientes.push({
        tipo: "pendiente",
        key: `p:${r.trabajo}:${p.orden}`,
        titulo: r.trabajo,
        fecha: p.fecha,
        orden: p.orden,
        subtitulo: `${conteo(p.items)} · ${rangoPendiente(fechas)}`,
        monto: p.items.reduce((acc, i) => acc + (i.monto || 0), 0),
        // La fecha más reciente del grupo ordena a los pendientes entre sí.
        refFecha: fechas[fechas.length - 1],
        lista: p.items,
      });
    }
  }
  /**
   * Lo más reciente arriba DENTRO de los pendientes (los cobrados ya vienen
   * ordenados por fecha de cobro DESC desde la consulta). El orden se resuelve **por
   * trabajo** (con su ítem más nuevo) y, adentro de un trabajo, por sección —la
   * ventana cerrada, que es la plata que ya se puede cobrar, arriba de la en curso—:
   * así las dos filas de un mismo trabajo quedan **juntas**.
   */
  const masNuevo = new Map<string, string>();
  for (const f of filasPendientes) {
    const prev = masNuevo.get(f.titulo);
    if (prev === undefined || f.refFecha > prev) {
      masNuevo.set(f.titulo, f.refFecha);
    }
  }
  filasPendientes.sort((a, b) => {
    const pa = masNuevo.get(a.titulo) ?? "";
    const pb = masNuevo.get(b.titulo) ?? "";
    if (pa !== pb) return pa < pb ? 1 : -1;
    if (a.titulo !== b.titulo) return a.titulo < b.titulo ? -1 : 1;
    return a.orden - b.orden;
  });
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
  /**
   * ¿La fila es un pendiente de la ventana **en curso** (todavía no cobrable)?
   * ⇒ el monto va **ámbar** en vez de verde, en la fila y en cada ítem desplegado.
   */
  const esEnCurso = (f: Fila) =>
    f.tipo === "pendiente" && f.fecha?.tipo === "enCurso";
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
  const filasVisibles = filas.filter((f) => {
    if (pestana === "cobrados") return f.tipo === "cobrado";
    if (pestana === "porCobrar") {
      // Los pendientes sin período estimado conservan la categoría cobrable,
      // igual que su color verde en la grilla original.
      return f.tipo === "pendiente" && !esEnCurso(f);
    }
    return esEnCurso(f);
  });
  const etiquetaVacia =
    pestana === "cobrados"
      ? "No hay períodos cobrados"
      : pestana === "porCobrar"
        ? "No hay períodos por cobrar"
        : "No hay períodos en curso";
  const exportarPeriodo = (fila: Fila) => {
    try {
      const doc = new jsPDF();
      const propinas =
        fila.tipo === "pendiente"
          ? fila.lista.reduce((total, item) => total + item.montoPropina, 0)
          : fila.liquidacion.jornadas.reduce(
              (total, jornada) => total + (jornada.montoPropina ?? 0),
              0
            );
      const estado =
        fila.tipo === "cobrado"
          ? "Cobrado"
          : fila.fecha?.tipo === "enCurso"
            ? "En curso"
            : "Por cobrar";
      const items =
        fila.tipo === "pendiente"
          ? fila.lista.map((item) => ({
              fecha: item.fecha,
              detalle: detalleItem(item),
              monto: item.monto,
              propina: item.montoPropina,
            }))
          : [
              ...fila.liquidacion.jornadas.map((jornada) => ({
                fecha: isoFecha(jornada.fechaJornada),
                detalle: `${decimalToTime(jornada.horaDesde)} a ${decimalToTime(jornada.horaHasta)}`,
                monto: jornada.montoJornada ?? 0,
                propina: jornada.montoPropina ?? 0,
              })),
              ...fila.liquidacion.tareas.map((tarea) => ({
                fecha: isoFecha(tarea.fechaTarea),
                detalle: `${tarea.descripcion?.trim() || "Tarea"}${tarea.horasTarea ? ` · ${tarea.horasTarea} h` : ""}`,
                monto: tarea.montoTarea ?? 0,
                propina: 0,
              })),
            ].sort((a, b) => a.fecha.localeCompare(b.fecha));
      const filasExport = items.length
        ? items.map((item) => [
            diaMes(item.fecha),
            item.detalle,
            numberToCurrency(item.monto, currency),
            item.propina > 0 ? numberToCurrency(item.propina, currency) : "—",
          ])
        : [["—", "Sin jornadas ni tareas detalladas", "—", "—"]];

      doc.setFontSize(16);
      doc.text(fila.titulo, 14, 18);
      doc.setFontSize(10);
      const info = [
        `Estado: ${estado}`,
        `Período: ${fila.subtitulo}`,
        `${fila.tipo === "cobrado" ? "Monto cobrado" : "Total"}: ${numberToCurrency(fila.monto, currency)}`,
        `Propinas: ${numberToCurrency(propinas, currency)}`,
      ];
      if (fila.tipo === "cobrado" && fila.liquidacion.fechaDeCobro) {
        info.push(`Fecha de cobro: ${diaMesLocal(fila.liquidacion.fechaDeCobro)}`);
      }
      doc.text(info, 14, 26);
      autoTable(doc, {
        startY: 30 + info.length * 5,
        head: [["Fecha", "Detalle", "Importe", "Propina"]],
        body: filasExport,
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [76, 110, 245], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
      });
      const nombreSeguro = fila.titulo
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      doc.save(`periodo-${nombreSeguro || "trabajo"}-${fila.key.replace(/[^a-z0-9-]/gi, "-")}.pdf`);
    } catch (error) {
      console.error("No se pudo exportar el período", error);
      toast.error("No se pudo exportar el período");
    }
  };

  return (
    <>
      <SwipeRowActions actionsFor={accionesFila} swipeFromAnywhere>
        <div className="overflow-hidden rounded-2xl border border-border bg-card px-3">
          <div className="flex justify-center border-b border-border py-2">
            <Tabs
              tabs={[
                {
                  id: "enCurso",
                  label: `En curso${pestana === "enCurso" ? ` · ${numberToCurrency(enCurso.monto, currency)}` : ""}`,
                },
                {
                  id: "porCobrar",
                  label: `Por cobrar${pestana === "porCobrar" ? ` · ${numberToCurrency(porCobrar.monto, currency)}` : ""}`,
                },
                { id: "cobrados", label: "Cobrados" },
              ]}
              activeTab={pestana}
              onTabChange={setPestana}
            />
          </div>
          {filasVisibles.length === 0 ? (
            <div className="flex min-h-24 items-center justify-center text-[13px] text-subtitle">
              {etiquetaVacia}
            </div>
          ) : filasVisibles.map((f) => {
          const esPendiente = f.tipo === "pendiente";
          const isAbierta = esPendiente || abierta === f.key;
          return (
            <div
              key={f.key}
              className={
                f.tipo === "pendiente"
                  ? "mb-2 first:mt-2 rounded-xl border border-border bg-muted/40 px-2"
                  : "border-b border-border last:border-b-0"
              }
            >
              <div className="flex items-start gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (!esPendiente) setAbierta(isAbierta ? null : f.key);
                  }}
                  disabled={esPendiente}
                  aria-expanded={isAbierta}
                  className="flex min-w-0 flex-1 items-start gap-2.5 py-2.5 text-left [-webkit-tap-highlight-color:transparent]"
                >
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] break-words text-header">
                    {f.titulo}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block text-subtitle",
                      f.tipo === "pendiente" && f.fecha
                        ? "whitespace-nowrap text-[10px] leading-[15px]"
                        : f.tipo === "cobrado"
                          ? "whitespace-nowrap text-[10px] leading-[15px]"
                          : "text-[11px] leading-[15px]"
                    )}
                  >
                    {f.subtitulo}
                  </span>
                  {f.tipo === "pendiente" && f.fecha && (
                    <span className="mt-0.5 flex items-center justify-between gap-2 whitespace-nowrap text-[10px] leading-[14px] font-medium">
                      {/* Un renglón propio mantiene el cierre a la izquierda y
                          la fecha estimada de pago alineada a la derecha. */}
                      <span
                        className={
                          f.fecha.tipo === "enCurso"
                            ? "text-warning"
                            : "text-success"
                        }
                      >
                        {f.fecha.tipo === "enCurso" ? "cierra el " : "cerró el "}
                        {diaMes(f.fecha.cierre)}
                      </span>
                      {f.fecha.pago && (
                        <span
                          className={
                            f.fecha.tipo === "enCurso"
                              ? "text-warning"
                              : "text-success"
                          }
                        >
                          pago ~{diaMes(f.fecha.pago)}
                        </span>
                      )}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right">
                  {/* Verde = pendiente de una ventana **cerrada** (se cobra ya) ·
                      **ámbar** = pendiente **en curso** (todavía no) · blanco = ya
                      cobrado. */}
                  <span
                    className={cn(
                      "block text-[14.5px] tabular-nums",
                      f.tipo === "cobrado"
                        ? "text-value"
                        : esEnCurso(f)
                          ? "text-warning"
                          : "text-success"
                    )}
                  >
                    {numberToCurrency(f.monto, currency)}
                  </span>
                </span>
                {!esPendiente && (
                  <ChevronDown
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0 text-subtitle transition-transform",
                      isAbierta && "rotate-180"
                    )}
                  />
                )}
                </button>
                <button
                  type="button"
                  onClick={() => exportarPeriodo(f)}
                  aria-label={`Exportar período de ${f.titulo}`}
                  title="Exportar período a PDF"
                  className="mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-subtitle transition-colors hover:bg-muted hover:text-header"
                >
                  <FileDown className="h-4 w-4" />
                </button>
              </div>

              {isAbierta && (
                <div className="pb-2.5 pl-3">
                  {f.tipo === "pendiente" ? (
                    f.lista.map((i) => (
                      <div
                        key={`${i.tipo}:${i.id}`}
                        data-row-id={`${i.tipo}:${i.id}`}
                        className="flex items-start gap-2 py-1.5"
                      >
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
                        <span
                          className={cn(
                            "shrink-0 text-[12.5px] tabular-nums",
                            esEnCurso(f) ? "text-warning" : "text-success"
                          )}
                        >
                          {numberToCurrency(i.monto || 0, currency)}
                        </span>
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
      </SwipeRowActions>

      {/* Centinela del scroll infinito: al entrar en pantalla (con `PRELOAD_PX`
          de margen) se pide la tanda siguiente de cobradas. Con una lista de otro
          filtro (`listaVieja`) no se pagina: se espera la recarga con el nuevo. */}
      {pestana === "cobrados" && (
        <div ref={centinelaRef} aria-hidden="true" className="h-px" />
      )}
      {pestana === "cobrados" && hayMas && cargando && !listaVieja && (
        <div className="flex justify-center py-3">
          <p className="flex items-center gap-2 text-[12px] text-subtitle">
            <NavSpinner className="text-primary" />
            Cargando más períodos…
          </p>
        </div>
      )}
      {pestana === "cobrados" && hayMas && !cargando && !listaVieja && (
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
