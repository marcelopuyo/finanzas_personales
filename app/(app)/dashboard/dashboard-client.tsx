"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { StatBadge } from "@/components/ui/stat-badge";
import { Tabs } from "@/components/ui/tabs";
import { Modal } from "@/components/ui/modal";
import { Checkbox } from "@/components/ui/checkbox";
import { DateRangeFields } from "@/components/ui/date-picker";
import { AccountCard } from "./components/account-card";
import { CuentasActionsMenu } from "./components/cuentas-actions-menu";
import { TrabajosActionsMenu } from "./components/trabajos-actions-menu";
import { DonutChart } from "./components/donut-chart";
import { EvolutionChart } from "./components/line-chart";
import { PrestamosChart } from "./components/prestamos-chart";
import { PrestamosActionsMenu } from "./components/prestamos-actions-menu";
import { GastosActionsMenu } from "./components/gastos-actions-menu";
import { GastosDetalle } from "./components/gastos-detalle";
import { IngresosDetalle } from "./components/ingresos-detalle";
import { HistorialModal, type CuentaHistorial } from "./components/historial-modal";
import { PeriodosModal, type TipoPeriodos } from "./components/periodos-modal";
import { PeriodosTrabajoLista } from "./components/periodos-trabajo-lista";
import type { DashboardData } from "./dashboard-data";
import { gastosEvolucionPor } from "./gastos-agrupacion";
import {
  evolucionIngresosPorMes,
  ingresosDelMesActual,
  ingresosEnRango,
} from "./ingresos-helpers";
import type { GastoOut } from "@/backend/src/queries/gastos";
import type { PeriodoTrabajoOut } from "@/backend/src/queries/trabajos";
import { periodoCobrado } from "@/backend/src/lib/jornadas";
import { cn, numberToCurrency, todayLocalISODate } from "@/lib/utils";
import { useMontado } from "@/lib/use-cliente";
import { usePendingNav, usePrefetchNav } from "@/components/ui/nav-progress";

interface Props {
  data: DashboardData;
  /** Popup de períodos a reabrir al montar ("cobrar" | "actuales"). Se usa al
      volver desde la pantalla de un período (?periodos=...) para restaurar el
      listado desde el que se entró. */
  periodosInicial?: string;
}

const SIN_CATEGORIA = "Sin categoría";
const SIN_CUENTA = "Sin cuenta";
/** Destino del PANEL "Trabajo" completo (ver `dashboard-client`): cualquier clic
    dentro del panel, salvo el menú ⋯, abre el CRUD de períodos. */
const HREF_PERIODOS = "/cruds/periodos-trabajo?origen=dashboard";
const SIN_TRABAJO = "Sin trabajo";

function toDateKey(v: string | Date | null | undefined): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

export function DashboardClient({ data, periodosInicial }: Props) {
  // El panel "Trabajo" entero navega al CRUD de períodos (2026-09-17): `navGo`
  // enciende la barra de progreso global (navegación programática) y `prefetch`
  // pide el RSC al pasar el mouse o apoyar el dedo, así la llegada es inmediata.
  const { go: navGo } = usePendingNav();
  const prefetch = usePrefetchNav();
  const abrirPeriodos = () => navGo(HREF_PERIODOS, "periodos");
  const [tabGastos, setTabGastos] = useState("resumen");
  const [tabIngresos, setTabIngresos] = useState("resumen");
  // Cuenta seleccionada para abrir su historial en popup
  const [cuentaHist, setCuentaHist] = useState<CuentaHistorial | null>(null);
  // Popup de las tarjetas sintéticas de períodos (a cobrar / actuales). Si se
  // volvió desde la pantalla de un período (periodosInicial) se abre directo.
  const [periodosModal, setPeriodosModal] = useState<TipoPeriodos | null>(
    periodosInicial === "cobrar" || periodosInicial === "actuales"
      ? periodosInicial
      : null
  );

  // Fechas por defecto: primer día del mes actual → hoy
  const fechaPrimerDia = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  };
  const fechaHoy = () => todayLocalISODate();

  const [selCat, setSelCat] = useState<string[]>([]);
  const [selCta, setSelCta] = useState<string[]>([]);
  const [selFd, setSelFd] = useState(fechaPrimerDia);
  const [selFh, setSelFh] = useState(fechaHoy);
  const [open, setOpen] = useState(false);
  const [dCat, setDCat] = useState<string[]>([]);
  const [dCta, setDCta] = useState<string[]>([]);
  const [dFd, setDFd] = useState(fechaPrimerDia);
  const [dFh, setDFh] = useState(fechaHoy);
  // Búsqueda de la tab "Detalle" de Gastos: el ícono vive junto al botón
  // "Filtros" (primera fila) y abre/cierra el input de búsqueda.
  const [busquedaGastos, setBusquedaGastos] = useState("");
  const [busquedaGastosOpen, setBusquedaGastosOpen] = useState(false);

  // Filtros de Ingresos (trabajo + fechas)
  const [selTra, setSelTra] = useState<string[]>([]);
  // Fechas por defecto: primer día del mes actual → hoy.
  const [selFdIng, setSelFdIng] = useState(fechaPrimerDia);
  const [selFhIng, setSelFhIng] = useState(fechaHoy);
  const [openIng, setOpenIng] = useState(false);
  const [dTra, setDTra] = useState<string[]>([]);
  const [dFdIng, setDFdIng] = useState("");
  const [dFhIng, setDFhIng] = useState("");

  const todosLosGastos: GastoOut[] = data.gastosDetalle;
  const todosLosIngresos: PeriodoTrabajoOut[] = data.ingresosDetalle;

  const hoy = todayLocalISODate();

  // ¿Se está visualizando el "mes actual" (sin filtros de fechas aplicados)?
  // Solo en ese caso se muestran las flechas de tendencia "vs mes anterior".
  const esMesActualGastos = selFd === fechaPrimerDia() && selFh === fechaHoy();
  const esMesActualIngresos =
    selFdIng === fechaPrimerDia() && selFhIng === fechaHoy();

  // Rango (inclusive) del MES ANTERIOR para comparar montos.
  const fechaAhora = new Date();
  const prevYear =
    fechaAhora.getMonth() === 0 ? fechaAhora.getFullYear() - 1 : fechaAhora.getFullYear();
  const prevMonth = fechaAhora.getMonth() === 0 ? 12 : fechaAhora.getMonth(); // 1-based
  const prevInicioKey = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
  const prevFinKey = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(
    new Date(prevYear, prevMonth, 0).getDate()
  ).padStart(2, "0")}`;

  // Listados de períodos para las tarjetas sintéticas del panel Trabajo
  // ("cobrado" = tiene fecha de cobro real, según el helper del backend):
  // - "Por cobrar": cerrados (fecha final < hoy) y no cobrados.
  // - "Actuales": ya comenzados (desde <= hoy) y con fecha final >= hoy
  //   (misma condición que la tarjeta del dashboard), cobrados O NO (el cobro
  //   adelantado dejó períodos cobrados que siguen en curso).
  // La tarjeta "Finalizados" no necesita listado acá: sólo navega al CRUD de
  // períodos filtrado por los ya cobrados y terminados.
  const periodosCobrar = useMemo(
    () =>
      todosLosIngresos
        .filter((p) => !periodoCobrado(p) && toDateKey(p.fechaHasta) < hoy)
        .sort((a, b) =>
          toDateKey(b.fechaHasta).localeCompare(toDateKey(a.fechaHasta))
        ),
    [todosLosIngresos, hoy]
  );

  const periodosActuales = useMemo(
    () =>
      todosLosIngresos
        .filter(
          (p) =>
            // Misma condición que la tarjeta "Actuales" del dashboard: ya
            // comenzado (desde <= hoy) y no terminado (hasta >= hoy).
            // ⚠️ Incluye los YA COBRADOS: con el COBRO ADELANTADO (decisión del
            // usuario 2026-09-14) un período fijo/horas_fijas puede estar cobrado
            // y seguir en curso; el panel lo sigue mostrando acá, con el tag
            // "Cobrado" (ver periodos-trabajo-lista.tsx).
            toDateKey(p.fechaHasta) >= hoy &&
            toDateKey(p.fechaDesde) <= hoy
        )
        .sort((a, b) =>
          toDateKey(a.fechaHasta).localeCompare(toDateKey(b.fechaHasta))
        ),
    [todosLosIngresos, hoy]
  );

  // Badges "Mes actual" de Gastos, Ingresos y Resultados. El servidor (Vercel,
  // UTC) los calcula con `new Date()` y en el límite de mes puede quedar ±1
  // día/mes adelantado respecto al usuario (ej. GMT-3 de noche el 31 → el
  // server ya está en el 1° → marca 0). `montado` es false en el SSR y en la
  // hidratación (se muestran los valores del servidor, sin desajuste) y true
  // después: ahí se recalculan con la fecha LOCAL del navegador
  // (primer día del mes → hoy).
  const montado = useMontado();
  const badges = useMemo(() => {
    if (!montado) {
      return {
        gastos: data.gastosTotal,
        ingresos: data.ingresosMesActual,
        resultados: data.resultadosMesActual,
      };
    }

    // Badge "Mes actual" de Gastos: fechaPago en [primer día del mes, hoy].
    const hasta = todayLocalISODate();
    const desde = `${hasta.slice(0, 7)}-01`;
    let totalG = 0;
    todosLosGastos.forEach((g) => {
      const f = toDateKey(g.fechaPago);
      if (f >= desde && f <= hasta) totalG += g.monto;
    });

    // Badge "Mes actual" de Ingresos: jornadas/tareas del mes + prorrateo de
    // fijo/horas_fijas contra el mes calendario completo (§8).
    const totalI = ingresosDelMesActual(todosLosIngresos, hasta);
    const iso = data.monedaPredeterminadaISO;

    return {
      gastos: numberToCurrency(totalG, iso),
      ingresos: numberToCurrency(totalI, iso),
      // Badge "Mes actual" de Resultados: ingresos del mes − gastos del mes
      // (misma ventana [desde, hoy] que los badges anteriores, para que la
      // resta sea coherente con los montos que muestran Ingresos y Gastos).
      resultados: numberToCurrency(totalI - totalG, iso),
    };
  }, [
    montado,
    todosLosGastos,
    todosLosIngresos,
    data.gastosTotal,
    data.ingresosMesActual,
    data.resultadosMesActual,
    data.monedaPredeterminadaISO,
  ]);

  const filteredGastos = useMemo(() => {
    let r = todosLosGastos;
    if (selCat.length > 0)
      r = r.filter((g) => selCat.includes(g.categoria?.nombre || SIN_CATEGORIA));
    if (selCta.length > 0)
      r = r.filter((g) => selCta.includes(g.cuenta || SIN_CUENTA));
    if (selFd) r = r.filter((g) => toDateKey(g.fechaPago) >= selFd);
    if (selFh) r = r.filter((g) => toDateKey(g.fechaPago) <= selFh);
    return r;
  }, [todosLosGastos, selCat, selCta, selFd, selFh]);

  // filteredGastos pero SIN el filtro de categoría (para el panel Resumen)
  const filteredSinCat = useMemo(() => {
    let r = todosLosGastos;
    if (selCta.length > 0)
      r = r.filter((g) => selCta.includes(g.cuenta || SIN_CUENTA));
    if (selFd) r = r.filter((g) => toDateKey(g.fechaPago) >= selFd);
    if (selFh) r = r.filter((g) => toDateKey(g.fechaPago) <= selFh);
    return r;
  }, [todosLosGastos, selCta, selFd, selFh]);

  // filteredGastos pero SIN el filtro de fechas (para el panel Histórico)
  const filteredSinFecha = useMemo(() => {
    let r = todosLosGastos;
    if (selCat.length > 0)
      r = r.filter((g) => selCat.includes(g.categoria?.nombre || SIN_CATEGORIA));
    if (selCta.length > 0)
      r = r.filter((g) => selCta.includes(g.cuenta || SIN_CUENTA));
    return r;
  }, [todosLosGastos, selCat, selCta]);

  const filteredResumen = useMemo(() => {
    // Resumen usa filteredSinCat (no filtra por categoría)
    const map = new Map<string, { saldo: number; pagado: number }>();
    filteredSinCat.forEach((g) => {
      const name = g.categoria?.nombre || SIN_CATEGORIA;
      const e = map.get(name) || { saldo: 0, pagado: 0 };
      e.saldo += g.saldo;
      e.pagado += g.monto - g.saldo;
      map.set(name, e);
    });
    return Array.from(map.entries()).map(([name, v]) => ({
      name,
      saldo: v.saldo,
      pagado: v.pagado,
    }));
  }, [filteredSinCat]);

  // Totales del MES ANTERIOR por categoría (mismas cuentas filtradas, sin
  // fechas) para las flechas de tendencia del resumen de gastos.
  const gastosMesAnterior = useMemo(() => {
    const map = new Map<string, number>();
    todosLosGastos.forEach((g) => {
      if (selCta.length > 0 && !selCta.includes(g.cuenta || SIN_CUENTA)) return;
      const f = toDateKey(g.fechaPago);
      if (f >= prevInicioKey && f <= prevFinKey) {
        const name = g.categoria?.nombre || SIN_CATEGORIA;
        map.set(name, (map.get(name) || 0) + g.monto);
      }
    });
    return map;
  }, [todosLosGastos, selCta, prevInicioKey, prevFinKey]);

  const gastosPrevTotal = useMemo(
    () => Array.from(gastosMesAnterior.values()).reduce((a, b) => a + b, 0),
    [gastosMesAnterior]
  );

  // Evolución del panel Histórico (sin filtro de fechas → TODO el histórico):
  // SIEMPRE agrupado por MES CALENDARIO según la fecha de pago, ordenado
  // cronológicamente. Ya no usa el período de gasto.
  const filteredEvolucion = useMemo(
    () => gastosEvolucionPor(filteredSinFecha, "mensual"),
    [filteredSinFecha]
  );

  const activeFilters =
    selCat.length + selCta.length + 2; // fechas siempre activas (desde/hasta por defecto)

  const categorias = useMemo(
    () =>
      [
        ...new Set(todosLosGastos.map((g) => g.categoria?.nombre || SIN_CATEGORIA)),
      ].sort(),
    [todosLosGastos]
  );

  const cuentas = useMemo(
    () =>
      [...new Set(todosLosGastos.map((g) => g.cuenta || SIN_CUENTA))].sort(),
    [todosLosGastos]
  );

  const openFilters = () => {
    setDCat(selCat); setDCta(selCta); setDFd(selFd); setDFh(selFh);
    setOpen(true);
  };
  const apply = () => {
    setSelCat(dCat); setSelCta(dCta); setSelFd(dFd); setSelFh(dFh);
    setOpen(false);
  };
  const limpiar = () => {
    const fd = fechaPrimerDia();
    const fh = fechaHoy();
    setDCat([]); setDCta([]); setDFd(fd); setDFh(fh);
    setSelCat([]); setSelCta([]); setSelFd(fd); setSelFh(fh);
    setOpen(false);
  };

  // className opcional: permite mostrar el botón solo en mobile (junto al
  // título) o solo en desktop (junto a los tabs).
  const filterBtn = (className?: string) => (
    <button
      type="button"
      onClick={openFilters}
      aria-label={activeFilters > 0 ? `Filtros (${activeFilters} aplicados)` : "Filtros"}
      title="Filtros"
      className={cn(
        // Alto fijo h-8 (32px) = el de los Tabs y el del botón de búsqueda, para
        // que la fila de controles del panel quede pareja. Además evita que el
        // botón crezca 2px cuando aparece el badge de filtros activos.
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors",
        activeFilters > 0
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-muted text-card-foreground hover:bg-card",
        className
      )}
    >
      <SlidersHorizontal className="h-3.5 w-3.5" />
      {activeFilters > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {activeFilters}
        </span>
      )}
    </button>
  );

  // Botón de búsqueda de la tab "Detalle" de Gastos: solo el ícono, con el mismo
  // estilo pill del botón "Filtros" en tono gris. Alterna el input expandido.
  const toggleBusquedaGastos = () => {
    // Al cerrar se limpia el texto para no dejar la grilla filtrada sin input.
    if (busquedaGastosOpen) setBusquedaGastos("");
    setBusquedaGastosOpen(!busquedaGastosOpen);
  };
  const gastoSearchBtn = (className?: string) => (
    <button
      type="button"
      onClick={toggleBusquedaGastos}
      aria-label={
        busquedaGastosOpen ? "Cerrar búsqueda de gastos" : "Buscar gastos"
      }
      aria-expanded={busquedaGastosOpen}
      title={busquedaGastosOpen ? "Cerrar búsqueda" : "Buscar"}
      className={cn(
        // Alto fijo h-8 (32px): mismo que "Filtros" y los Tabs. En mobile es un
        // botón CUADRADO (w-8, sin padding) para que la fila 2 del panel Gastos
        // entre en una sola línea a 320px; en desktop vuelve a ser píldora.
        "inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted text-card-foreground transition-colors hover:bg-card sm:w-auto sm:px-3",
        className
      )}
    >
      <Search className="h-3.5 w-3.5" />
    </button>
  );

  // ---- Filtros de Ingresos ----
  const activeIngFilters =
    selTra.length + (selFdIng ? 1 : 0) + (selFhIng ? 1 : 0);

  const trabajos = useMemo(
    () =>
      [
        ...new Set(todosLosIngresos.map((p) => p.trabajo?.nombre || SIN_TRABAJO)),
      ].sort(),
    [todosLosIngresos]
  );

  // Detalle: trabajo + fechas. Los períodos abarcan un rango [fechaDesde,
  // fechaHasta], así que se filtra por SOLAPAMIENTO con el rango elegido (no
  // solo por la columna "desde"): un período que comenzó el mes pasado pero
  // sigue vigente este mes (fechaHasta >= inicio) debe verse en el detalle.
  const filteredIngresos = useMemo(() => {
    let r = todosLosIngresos;
    if (selTra.length > 0)
      r = r.filter((p) => selTra.includes(p.trabajo?.nombre || SIN_TRABAJO));
    if (selFdIng || selFhIng) {
      r = r.filter(
        (p) =>
          (!selFdIng || toDateKey(p.fechaHasta) >= selFdIng) &&
          (!selFhIng || toDateKey(p.fechaDesde) <= selFhIng)
      );
    }
    return r;
  }, [todosLosIngresos, selTra, selFdIng, selFhIng]);

  // Histórico: solo trabajo (sin fechas)
  const filteredIngresosSinFechaIng = useMemo(() => {
    let r = todosLosIngresos;
    if (selTra.length > 0)
      r = r.filter((p) => selTra.includes(p.trabajo?.nombre || SIN_TRABAJO));
    return r;
  }, [todosLosIngresos, selTra]);

  // Resumen por trabajo: suma JORNADAS, TAREAS y prorrateo de fijo/horas_fijas
  // cuya fecha cae en el rango elegido (la fecha afecta al resumen, el trabajo
  // no). Con fechas vacías muestra todo.
  const filteredIngresosResumen = useMemo(() => {
    const rango = ingresosEnRango(
      todosLosIngresos,
      selFdIng || undefined,
      selFhIng || undefined
    );
    return Array.from(rango.porTrabajo.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  }, [todosLosIngresos, selFdIng, selFhIng]);

  // Totales del MES ANTERIOR por trabajo (jornadas + tareas + prorrateo) para
  // las flechas de tendencia de ingresos.
  const ingresosMesAnterior = useMemo(() => {
    return ingresosEnRango(todosLosIngresos, prevInicioKey, prevFinKey).porTrabajo;
  }, [todosLosIngresos, prevInicioKey, prevFinKey]);

  const ingresosPrevTotal = useMemo(
    () => Array.from(ingresosMesAnterior.values()).reduce((a, b) => a + b, 0),
    [ingresosMesAnterior]
  );

  // Histórico por mes (jornadas + tareas + prorrateo de fijo/horas_fijas) de
  // los períodos filtrados por trabajo. `hoy` se pasa para que en horas_fijas el
  // mes en curso se corte a la fecha (devengado hasta hoy).
  const filteredIngresosEvolucion = useMemo(
    () => evolucionIngresosPorMes(filteredIngresosSinFechaIng, hoy),
    [filteredIngresosSinFechaIng, hoy]
  );

  const openIngFilters = () => {
    setDTra(selTra); setDFdIng(selFdIng); setDFhIng(selFhIng); setOpenIng(true);
  };
  const applyIng = () => {
    setSelTra(dTra); setSelFdIng(dFdIng); setSelFhIng(dFhIng); setOpenIng(false);
  };
  const limpiarIng = () => {
    setDTra([]); setDFdIng(fechaPrimerDia()); setDFhIng(fechaHoy());
    setSelTra([]); setSelFdIng(fechaPrimerDia()); setSelFhIng(fechaHoy());
    setOpenIng(false);
  };

  const ingFilterBtn = (className?: string) => (
    <button
      type="button"
      onClick={openIngFilters}
      aria-label={activeIngFilters > 0 ? `Filtros (${activeIngFilters} aplicados)` : "Filtros"}
      title="Filtros"
      className={cn(
        // Alto fijo h-8 (32px): mismo que los Tabs (coherente con el panel Gastos).
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors",
        activeIngFilters > 0
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-muted text-card-foreground hover:bg-card",
        className
      )}
    >
      <SlidersHorizontal className="h-3.5 w-3.5" />
      {activeIngFilters > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {activeIngFilters}
        </span>
      )}
    </button>
  );

  const gastosTabs = (
    <Tabs
      tabs={[
        { id: "resumen", label: "Resumen" },
        { id: "detalle", label: "Detalle" },
        { id: "historico", label: "Histórico" },
      ]}
      activeTab={tabGastos}
      onTabChange={setTabGastos}
    />
  );

  // Acciones de la cabecera de "Gastos" (Filtros + pestañas + ⋯, más el botón de
  // Búsqueda en la pestaña Detalle). En mobile el grupo ocupa todo el ancho del
  // panel y el ⋯ se pega al BORDE DERECHO con `ml-auto`, así queda en la misma
  // posición esté o no el botón de búsqueda; en desktop van todos en línea, a la
  // derecha del badge (`sm:w-auto` / `sm:ml-0`).
  const gastosHeaderActions = (buscar = false) => (
    <div className="flex w-full items-center gap-1 sm:w-auto sm:gap-2">
      {buscar && gastoSearchBtn("sm:hidden")}
      {filterBtn("hidden sm:inline-flex")}
      {buscar && gastoSearchBtn("hidden sm:inline-flex")}
      {gastosTabs}
      <div className="ml-auto sm:ml-0">
        <GastosActionsMenu />
      </div>
    </div>
  );

  const ingresosTabs = (
    <Tabs
      tabs={[
        { id: "resumen", label: "Resumen" },
        { id: "detalle", label: "Detalle" },
        { id: "historico", label: "Histórico" },
      ]}
      activeTab={tabIngresos}
      onTabChange={setTabIngresos}
    />
  );

  return (
    <div className="space-y-6 pb-8 pt-4 lg:pt-0">
      {/* Balance Actual — tarjeta full-width con el MISMO alto que las tarjetas
          de cuentas y su texto centrado en vertical: flex + min-height igual al
          alto fijo de AccountCard (título + importe + área del gráfico h-10).
          El `pt-4 lg:pt-0` separa la tarjeta de la barra superior de menú en
          mobile (en desktop el main ya aporta margen superior, lg:pt-6). */}
      <div className="relative flex min-h-31.75 items-center justify-center rounded-lg border border-border bg-card p-4 shadow-sm">
        {/* Rótulo en el ángulo superior izquierdo, como el título de las
            tarjetas de cuentas (dentro del mismo padding p-4). */}
        <p className="absolute left-4 top-4 text-[16px] font-semibold text-header">Balance Actual</p>
        <p className="text-3xl font-semibold tracking-tight text-success">
          {numberToCurrency(data.balance, data.monedaPredeterminadaISO)}
        </p>
      </div>

      {/* Panel Cuentas — solo cuentas reales (clic abre el historial). El panel
          usa bg-card como el resto; las tarjetas internas van en bg-muted. */}
      <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
        {/* Encabezado: título a la izquierda y menú (⋮) anclado al ángulo
            superior derecho del panel (accede al CRUD de cuentas). */}
        <div className="relative mb-3 pr-8">
          <h2 className="text-[16px] font-semibold text-header">Cuentas</h2>
          <div className="absolute right-0 top-0 flex items-center">
            <CuentasActionsMenu />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.cuentas.map((cuenta, i) => (
            <AccountCard
              key={i}
              {...cuenta}
              onOpen={() => {
                if (cuenta.id != null) {
                  setCuentaHist({
                    id: cuenta.id,
                    nombre: cuenta.title,
                    saldo: cuenta.value,
                    monedaISO: cuenta.monedaISO ?? "ARS",
                    monedaPredeterminadaISO: data.monedaPredeterminadaISO,
                  });
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* Panel Trabajo — listado de períodos del trabajo (decision 2026-09-13):
          una sola lista con chip de estado por fila (por cobrar / en curso) en
          lugar de las tarjetas sintéticas. Los totales de cada grupo (arriba)
          abren el popup con la lista completa del grupo. SIEMPRE visible:
          aunque no haya períodos, permite gestionar trabajos (⋯).
          ⚠️ **El PANEL ENTERO es el área de clic** (decisión del usuario
          2026-09-17: antes solo navegaban las filas): cualquier punto —filas,
          encabezados de grupo, márgenes— abre el CRUD completo de períodos. El
          menú ⋯ queda EXCLUIDO (corta el `click` desde `TrabajosActionsMenu`) y
          las filas ya no tienen ninguna señal visual de clic. El prefetch se
          dispara al pasar el mouse o al apoyar el dedo, así la navegación sigue
          siendo instantánea (2026-09-14). Con `origen=dashboard` la flecha
          "Volver" regresa acá y el "+"/editar conservan el viaje. */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Ver todos los períodos de trabajo"
        onClick={abrirPeriodos}
        onKeyDown={(e) => {
          // Solo cuando el panel tiene el foco (no cuando lo tiene el ⋯).
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            abrirPeriodos();
          }
        }}
        onPointerEnter={() => prefetch(HREF_PERIODOS)}
        onTouchStart={() => prefetch(HREF_PERIODOS)}
        // Sin destello del tap en mobile (iOS/Android pintan un flash gris en el
        // elemento con el `onClick`): el panel navega sin NINGUNA señal visual.
        className="rounded-lg border border-border bg-card p-4 [-webkit-tap-highlight-color:transparent] sm:p-5"
      >
          {/* Encabezado: título a la izquierda y menú (⋯) anclado al ángulo
              superior derecho del panel (gestionar trabajos). */}
          <div className="relative mb-3 pr-8">
            <h2 className="text-[16px] font-semibold text-header">Trabajo</h2>
            <div className="absolute right-0 top-0 flex items-center">
              <TrabajosActionsMenu />
            </div>
          </div>
          <PeriodosTrabajoLista
            porCobrar={periodosCobrar}
            enCurso={periodosActuales}
            currency={data.monedaPredeterminadaISO}
          />
      </div>

      {/* Gastos Section — filtro compartido */}
      {tabGastos === "resumen" ? (
        <DonutChart
          title="Gastos"
          action={gastosHeaderActions()}
          badge={<><StatBadge label="Mes actual" value={badges.gastos} />{filterBtn("sm:hidden")}</>}
          currency={data.monedaPredeterminadaISO}
          data={filteredResumen.map((g) => ({
            name: g.name,
            value: g.pagado + g.saldo,
          }))}
          compare={esMesActualGastos ? {
            prevTotal: gastosPrevTotal,
            prevByName: Object.fromEntries(gastosMesAnterior),
          } : null}
        />
      ) : tabGastos === "detalle" ? (
        <div className="rounded-lg border border-border bg-card p-5">
          {/* Cabecera de "Gastos" (mobile, < sm): fila 1 = título + badge +
              Filtros; fila 2 = Búsqueda + pestañas + ⋯ (el ⋯ siempre pegado al
              borde derecho, esté o no el botón de búsqueda). En desktop (sm+)
              todo va en una sola fila, con Filtros/Búsqueda/pestañas/⋯ a la
              derecha del badge. Los botones son los mismos: cada uno se muestra
              sólo en la fila que le corresponde (`sm:hidden` /
              `hidden sm:inline-flex`). */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[16px] font-semibold text-header">Gastos</h3>
              <StatBadge label="Mes actual" value={badges.gastos} />
              {filterBtn("sm:hidden")}
            </div>
            {gastosHeaderActions(true)}
          </div>
          <GastosDetalle
            data={filteredGastos}
            total={todosLosGastos.length}
            currency={data.monedaPredeterminadaISO}
            search={busquedaGastos}
            onSearchChange={setBusquedaGastos}
            searchOpen={busquedaGastosOpen}
          />
        </div>
      ) : (
        <EvolutionChart
          title="Gastos"
          action={gastosHeaderActions()}
          badge={<><StatBadge label="Mes actual" value={badges.gastos} />{filterBtn("sm:hidden")}</>}
          currency={data.monedaPredeterminadaISO}
          data={filteredEvolucion}
          color="var(--primary)"
          area
        />
      )}

      {/* Ingresos Section — filtro compartido */}
      {tabIngresos === "resumen" ? (
        <DonutChart
          title="Ingresos"
          action={<div className="flex items-center gap-2">{ingFilterBtn("hidden sm:inline-flex")}{ingresosTabs}</div>}
          badge={<><StatBadge label="Mes actual" value={badges.ingresos} />{ingFilterBtn("sm:hidden")}</>}
          currency={data.monedaPredeterminadaISO}
          data={filteredIngresosResumen.map((i) => ({ name: i.name, value: i.value }))}
          invertTrend
          compare={esMesActualIngresos ? {
            prevTotal: ingresosPrevTotal,
            prevByName: Object.fromEntries(ingresosMesAnterior),
          } : null}
        />
      ) : tabIngresos === "detalle" ? (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[16px] font-semibold text-header">Ingresos</h3>
              <StatBadge label="Mes actual" value={badges.ingresos} />
              {ingFilterBtn("sm:hidden")}
            </div>
            <div className="flex items-center gap-2">{ingFilterBtn("hidden sm:inline-flex")}{ingresosTabs}</div>
          </div>
          <IngresosDetalle
            data={filteredIngresos}
            currency={data.monedaPredeterminadaISO}
          />
        </div>
      ) : (
        <EvolutionChart
          title="Ingresos"
          action={<div className="flex items-center gap-2">{ingFilterBtn("hidden sm:inline-flex")}{ingresosTabs}</div>}
          badge={<><StatBadge label="Mes actual" value={badges.ingresos} />{ingFilterBtn("sm:hidden")}</>}
          data={filteredIngresosEvolucion}
          color="var(--primary)"
          area
          currency={data.monedaPredeterminadaISO}
        />
      )}

      {data.evolucionResultados.length > 0 && (
        <EvolutionChart
          title="Resultados"
          badge={<StatBadge label="Mes actual" value={badges.resultados} />}
          data={data.evolucionResultados}
          color="var(--primary)"
          area
          currency={data.monedaPredeterminadaISO}
        />
      )}

      {/* Panel de préstamos: se muestra SIEMPRE (también sin préstamos
          cargados; en ese caso PrestamosChart muestra su estado vacío). */}
      <PrestamosChart
        title="Préstamos Pendientes"
        badge={
          <div className="flex flex-wrap items-center gap-2">
            {data.prestamosTotales.map((t) => (
              <StatBadge
                key={t.currency}
                label={`Saldo neto (${t.currency})`}
                value={t.value}
              />
            ))}
          </div>
        }
        data={data.prestamosChart.data}
        series={data.prestamosChart.series}
        action={<PrestamosActionsMenu />}
      />

      {/* Modal de filtros */}
      <Modal open={open} onClose={() => setOpen(false)} title="Filtros"
        footer={
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={limpiar}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-subtitle transition-colors hover:bg-muted hover:text-header">
              Limpiar
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-[13px] font-medium text-subtitle transition-colors hover:bg-muted hover:text-header">
                Cancelar
              </button>
              <button type="button" onClick={apply}
                className="rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90">
                Aplicar
              </button>
            </div>
          </div>
        }
      >
        <p className="mb-2 text-[13px] font-medium text-header">Categoría</p>
        <div className="space-y-2.5">
          {categorias.map((c) => (
            <Checkbox key={c} label={c} checked={dCat.includes(c)}
              onChange={() => setDCat((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])} />
          ))}
        </div>
        <div className="my-4 border-t border-border" />
        <p className="mb-2 text-[13px] font-medium text-header">Cuenta</p>
        <div className="space-y-2.5">
          {cuentas.map((c) => (
            <Checkbox key={c} label={c} checked={dCta.includes(c)}
              onChange={() => setDCta((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])} />
          ))}
        </div>
        <div className="my-4 border-t border-border" />
        <p className="mb-2 text-[13px] font-medium text-header">Fecha de pago</p>
        <DateRangeFields
          desde={dFd}
          hasta={dFh}
          onChangeDesde={setDFd}
          onChangeHasta={setDFh}
        />
      </Modal>

      {/* Modal de filtros de Ingresos */}
      <Modal open={openIng} onClose={() => setOpenIng(false)} title="Filtros"
        footer={
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={limpiarIng}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-subtitle transition-colors hover:bg-muted hover:text-header">
              Limpiar
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpenIng(false)}
                className="rounded-lg px-3 py-2 text-[13px] font-medium text-subtitle transition-colors hover:bg-muted hover:text-header">
                Cancelar
              </button>
              <button type="button" onClick={applyIng}
                className="rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90">
                Aplicar
              </button>
            </div>
          </div>
        }
      >
        <p className="mb-2 text-[13px] font-medium text-header">Trabajo</p>
        <div className="space-y-2.5">
          {trabajos.map((t) => (
            <Checkbox key={t} label={t} checked={dTra.includes(t)}
              onChange={() => setDTra((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])} />
          ))}
        </div>
        <div className="my-4 border-t border-border" />
        <p className="mb-2 text-[13px] font-medium text-header">Fecha</p>
        <DateRangeFields
          desde={dFdIng}
          hasta={dFhIng}
          onChangeDesde={setDFdIng}
          onChangeHasta={setDFhIng}
        />
      </Modal>

      {/* Popup de historial de cuenta */}
      <HistorialModal
        cuenta={cuentaHist}
        onClose={() => setCuentaHist(null)}
      />

      {/* Popup de las tarjetas sintéticas de períodos */}
      <PeriodosModal
        tipo={periodosModal}
        data={periodosModal === "cobrar" ? periodosCobrar : periodosActuales}
        currency={data.monedaPredeterminadaISO}
        onClose={() => setPeriodosModal(null)}
      />
    </div>
  );
}
