"use client";

import { useMemo, useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { PanelHeader } from "./components/panel-header";
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
import { GastosClient } from "@/app/(app)/gastos/gastos-client";
import { TrabajoClient } from "@/app/(app)/trabajo/trabajo-client";
import type { DashboardData } from "./dashboard-data";
import { gastosEvolucionPor } from "./gastos-agrupacion";
import {
  evolucionIngresosPorMes,
  ingresosDelMesActual,
  ingresosEnRango,
} from "./ingresos-helpers";
import { aFuenteIngresos } from "@/backend/src/lib/ingresos-trabajo";
import type { GastoOut, GastosPagina } from "@/backend/src/queries/gastos";
import type {
  ItemPendienteOut,
  LiquidacionOut,
} from "@/backend/src/queries/trabajos";
import { cn, numberToCurrency, todayLocalISODate } from "@/lib/utils";
import {
  SIN_CATEGORIA as FILTRO_SIN_CATEGORIA,
  SIN_CUENTA as FILTRO_SIN_CUENTA,
  SIN_TRABAJO as FILTRO_SIN_TRABAJO,
} from "@/lib/filtros-dashboard";
import { useMontado } from "@/lib/use-cliente";
import { usePendingNav } from "@/components/ui/nav-progress";

/**
 * Vista (pantalla) que se está pintando. Sin `solo` se pintan **todas**, que es el
 * comportamiento histórico (una sola página larga) y ya no lo usa ninguna ruta.
 */
export type Vista = "inicio" | "gastos" | "ingresos" | "resultados" | "prestamos";

interface Props {
  data: DashboardData;
  /** Pinta SOLO esta vista (2026-10-01, rama `rediseno-ui`). */
  solo?: Vista;
  /**
   * Primera tanda del listado **completo** de gastos (la resuelve el server en
   * `vista-page.tsx`, solo para la pantalla Gastos): su segundo panel embebe
   * `GastosClient` (búsqueda + scroll infinito) en vez de las tarjetas de los
   * últimos 3 días (2026-10-03).
   */
  gastosPrimeraPagina?: GastosPagina;
  /**
   * Datos de la **grilla unificada de trabajo** de la pantalla Ingresos
   * (2026-10-03): la monta este componente —y no la página— para que el **filtro de
   * trabajo** del mini-panel llegue **directo** a la grilla (es estado de acá).
   */
  trabajo?: {
    pendientes: ItemPendienteOut[];
    cobradosIniciales: LiquidacionOut[];
    hayMasCobrados: boolean;
    totalCobrados: number;
    cuentas: { id: number; nombre: string }[];
    /** ISO de la moneda del usuario (la usa la grilla). */
    monedaISO: string;
  };
}

/**
 * Envoltorio de bloque: lo pinta solo si corresponde a la vista activa.
 * ⚠️ Los hijos **no se montan** cuando `visible` es false — no se crean gráficos
 * ni tablas de las otras pantallas (el JSX igual se evalúa, pero es gratis).
 */
function Solo({
  visible,
  children,
}: {
  visible: boolean;
  children: ReactNode;
}) {
  return visible ? <>{children}</> : null;
}

const SIN_CATEGORIA = FILTRO_SIN_CATEGORIA;
const SIN_CUENTA = FILTRO_SIN_CUENTA;
const SIN_TRABAJO = FILTRO_SIN_TRABAJO;

function toDateKey(v: string | Date | null | undefined): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

export function DashboardClient({
  data,
  solo,
  gastosPrimeraPagina,
  trabajo,
}: Props) {
  /** ¿Se pinta esta vista? (sin `solo` se pintan todas) */
  const ver = (...vistas: Vista[]) => solo === undefined || vistas.includes(solo);

  /** Navegación con feedback (barra de progreso global). */
  const { go: navGo } = usePendingNav();
  const [tabGastos, setTabGastos] = useState("resumen");
  const [tabIngresos, setTabIngresos] = useState("resumen");

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
  // Liquidaciones del usuario con sus ítems (en el modelo nuevo nacen cobradas).
  const todosLosIngresos: LiquidacionOut[] = data.ingresosDetalle;
  // Fuente del panel de ingresos (**criterio DEVENGADO**): liquidaciones + ítems
  // pendientes de cobrar. El criterio vive en `lib/ingresos-trabajo`; acá se
  // rearma para poder recalcular el badge con la fecha LOCAL del navegador
  // (el SSR lo hace con la del servidor).
  const fuenteIngresos = useMemo(
    () => aFuenteIngresos(todosLosIngresos, data.itemsPendientes),
    [todosLosIngresos, data.itemsPendientes]
  );

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

    // Badge "Mes actual" de Ingresos: criterio ÚNICO **DEVENGADO** — ítems
    // (jornadas/tareas, con su propina) por su fecha, estén liquidados o
    // pendientes + prorrateo del rango en fijo/horas_fijas.
    const totalI = ingresosDelMesActual(fuenteIngresos, hasta);
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
    fuenteIngresos,
    data.gastosTotal,
    data.ingresosMesActual,
    data.resultadosMesActual,
    data.monedaPredeterminadaISO,
  ]);

  // ⚠️ El reparto de los pendientes en "Por cobrar / En curso / Sin período" se
  // movió a `TrabajoClient` (`useVentanasCobro`, 2026-10-01): ahora viaja como
  // **ficha dentro de cada fila de la grilla** de Ingresos, y allí se recalcula con
  // la fecha **LOCAL** del navegador (fix de §211).

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
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
          {activeFilters}
        </span>
      )}
    </button>
  );

  // ---- Filtros de Ingresos ----
  const activeIngFilters =
    selTra.length + (selFdIng ? 1 : 0) + (selFhIng ? 1 : 0);

  // Opciones del filtro "Trabajo": los de las liquidaciones **y** los de los
  // ítems pendientes (si no, un trabajo que todavía no cobró nada no se podría
  // filtrar aunque sus jornadas ya se estén mostrando en el Detalle).
  const trabajos = useMemo(
    () =>
      [
        ...new Set([
          ...todosLosIngresos.map((p) => p.trabajo?.nombre || SIN_TRABAJO),
          ...data.itemsPendientes.map((i) => i.trabajoNombre || SIN_TRABAJO),
        ]),
      ].sort(),
    [todosLosIngresos, data.itemsPendientes]
  );

  // Detalle: las **tarjetas** (2026-09-30, pedido del usuario: "lo mismo que en
  // Gastos") arman sus filas DENTRO de `IngresosTarjetas` a partir de las dos
  // fuentes completas (`todosLosIngresos` + `data.itemsPendientes`) y su propia
  // **ventana de 3 meses**, igual que las tarjetas de Gastos: la ventana es fija
  // y NO depende de los Filtros del panel (que siguen aplicando al Resumen y al
  // Histórico, y al listado completo de `/trabajo`).

  // Histórico: solo trabajo (sin fechas) — se filtra la FUENTE completa para que
  // la evolución use el mismo criterio que el badge y el resumen.
  const fuentePorTrabajo = useMemo(() => {
    if (selTra.length === 0) return fuenteIngresos;
    return {
      liquidaciones: fuenteIngresos.liquidaciones.filter((l) =>
        selTra.includes(l.trabajo)
      ),
      itemsPendientes: fuenteIngresos.itemsPendientes.filter((i) =>
        selTra.includes(i.trabajo)
      ),
    };
  }, [fuenteIngresos, selTra]);

  // Resumen por trabajo: lo DEVENGADO en el rango elegido (ítems por su fecha,
  // liquidados o pendientes) + prorrateo de fijo/horas_fijas. El trabajo NO
  // filtra el resumen, igual que en Gastos: ese filtro aplica al detalle y al
  // histórico.
  const filteredIngresosResumen = useMemo(() => {
    const rango = ingresosEnRango(
      fuenteIngresos,
      selFdIng || undefined,
      selFhIng || undefined
    );
    return Array.from(rango.porTrabajo.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  }, [fuenteIngresos, selFdIng, selFhIng]);

  // Totales del MES ANTERIOR por trabajo para las flechas de tendencia.
  const ingresosMesAnterior = useMemo(() => {
    return ingresosEnRango(fuenteIngresos, prevInicioKey, prevFinKey).porTrabajo;
  }, [fuenteIngresos, prevInicioKey, prevFinKey]);

  const ingresosPrevTotal = useMemo(
    () => Array.from(ingresosMesAnterior.values()).reduce((a, b) => a + b, 0),
    [ingresosMesAnterior]
  );

  // Histórico por mes con el MISMO criterio (P1.d) de los trabajos filtrados.
  const filteredIngresosEvolucion = useMemo(
    () => evolucionIngresosPorMes(fuentePorTrabajo),
    [fuentePorTrabajo]
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
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
          {activeIngFilters}
        </span>
      )}
    </button>
  );

  const gastosTabs = (
    <Tabs
      // Sin la pestaña "Detalle" (2026-10-01, `rediseno-ui`): ese listado pasó a
      // vivir SIEMPRE **debajo del panel**, como sección de la pantalla.
      tabs={[
        { id: "resumen", label: "Resumen" },
        { id: "historico", label: "Histórico" },
      ]}
      activeTab={tabGastos}
      onTabChange={setTabGastos}
    />
  );

  /**
   * **Mini-panel superior de Gastos** (2026-10-03): el mes, el monto, los Filtros y
   * el ⋯ salen del panel del gráfico a su **propio panel**, arriba de todo. El panel
   * del gráfico se queda con su **selector de pestañas** y el gráfico.
   *
   * 🔑 La **grilla** de abajo respeta estos mismos filtros (categoría y cuenta),
   * **menos las fechas**: el listado muestra todo el historial.
   */
  const gastosMiniPanel = (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <PanelHeader
        titulo="Gastos"
        contexto="mes actual"
        numero={badges.gastos}
        acciones={
          <>
            {filterBtn()}
            <GastosActionsMenu />
          </>
        }
      />
    </div>
  );

  /** Pestañas del panel de gráficos: van **dentro del panel**, alineadas a la
      derecha (el encabezado vive en el mini-panel de arriba). */
  const gastosPanelTabs = (
    <div className="mb-4 flex justify-end">{gastosTabs}</div>
  );

  const ingresosTabs = (
    <Tabs
      // Sin la pestaña "Detalle" (2026-10-01, `rediseno-ui`): ese listado se UNIFICÓ
      // en la sección de abajo, junto con el panel "Trabajo" y la grilla de
      // `/trabajo` (replanteo de la pantalla Ingresos).
      tabs={[
        { id: "resumen", label: "Resumen" },
        { id: "historico", label: "Histórico" },
      ]}
      activeTab={tabIngresos}
      onTabChange={setTabIngresos}
    />
  );

  /** **Mini-panel superior de Ingresos** (2026-10-03): mes + monto + Filtros + el ⋯
      de Trabajo (que antes vivía en el panel de la grilla). */
  const ingresosMiniPanel = (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <PanelHeader
        titulo="Ingresos"
        contexto="mes actual"
        numero={badges.ingresos}
        acciones={
          <>
            {ingFilterBtn()}
            <TrabajosActionsMenu />
          </>
        }
      />
    </div>
  );

  /** Pestañas del panel de gráficos de Ingresos (**dentro** del panel, a la derecha). */
  const ingresosPanelTabs = (
    <div className="mb-4 flex justify-end">{ingresosTabs}</div>
  );

  /**
   * Saldo neto **protagonista** del panel Préstamos: el de la moneda predeterminada
   * (o el primero, si no está) y los demás como texto secundario. Antes eran
   * píldoras `StatBadge` (una por moneda); el badge se eliminó en el diseño C.
   */
  const netoPred =
    data.prestamosTotales.find(
      (t) => t.currency === data.monedaPredeterminadaISO
    ) ?? data.prestamosTotales[0];
  const netosSecundarios = data.prestamosTotales.filter((t) => t !== netoPred);
  const prestamosNumero = netoPred ? (
    <>
      {netoPred.value}
      {netosSecundarios.map((t) => (
        <span key={t.currency} className="ml-2.5 text-[13px] text-subtitle">
          {t.currency} · {t.value}
        </span>
      ))}
    </>
  ) : null;

  /** **Encabezado del panel Préstamos** (diseño C): contexto + saldo neto + ⋯. */
  const prestamosPanelHeader = (
    <PanelHeader
      className="mb-4"
      titulo="Préstamos"
      contexto={netoPred ? "saldo neto" : "sin préstamos cargados"}
      numero={prestamosNumero}
      acciones={<PrestamosActionsMenu />}
    />
  );

  /** **Encabezado del panel Resultados** (diseño C): contexto + resultado del mes. */
  const resultadosPanelHeader = (
    <PanelHeader
      className="mb-4"
      titulo="Resultados"
      contexto="mes actual"
      numero={badges.resultados}
    />
  );

  return (
    <div className="space-y-6 pb-8 pt-4 lg:pt-0">
      {/* Balance Actual — tarjeta full-width con el MISMO alto que las tarjetas
          de cuentas y su texto centrado en vertical: flex + min-height igual al
          alto fijo de AccountCard (título + importe + área del gráfico h-10).
          El `pt-4 lg:pt-0` separa la tarjeta de la barra superior de menú en
          mobile (en desktop el main ya aporta margen superior, lg:pt-6). */}
      <Solo visible={ver("inicio")}>
      <div
        data-panel="balance"
        className="relative flex min-h-31.75 items-center justify-center rounded-2xl border border-border bg-card p-4 shadow-sm"
      >
        {/* Rótulo en el ángulo superior izquierdo, como el título de las
            tarjetas de cuentas (dentro del mismo padding p-4). */}
        <p className="absolute left-4 top-4 text-[16px] text-header">Balance Actual</p>
        <p className="text-3xl tracking-tight text-success">
          {numberToCurrency(data.balance, data.monedaPredeterminadaISO)}
        </p>
      </div>
      </Solo>

      {/* Panel Cuentas — solo cuentas reales (el toque abre la pantalla de sus
          movimientos, `/cuentas/[id]`). El panel usa bg-card como el resto; las
          tarjetas internas van en bg-muted. */}
      <Solo visible={ver("inicio")}>
      <div data-panel="cuentas" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        {/* Encabezado: título a la izquierda y menú (⋮) anclado al ángulo
            superior derecho del panel (accede al CRUD de cuentas). */}
        <div className="relative mb-3 pr-8">
          <h2 className="text-[16px] text-header">Cuentas</h2>
          <div className="absolute right-0 top-0 flex items-center">
            <CuentasActionsMenu />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.cuentas.map((cuenta, i) => (
            <AccountCard
              key={i}
              {...cuenta}
              // Navega a la pantalla de movimientos de la cuenta (2026-09-20:
              // antes abría un popup —una lista de contenido se navega—). El id
              // solo existe en las cuentas reales: las sintéticas quedan sin
              // acción (no son clickeables).
              onOpen={
                cuenta.id != null
                  ? () => navGo(`/cuentas/${cuenta.id}`, "cuenta")
                  : undefined
              }
            />
          ))}
        </div>
      </div>
      </Solo>

      {/* Gastos Section — filtro compartido. El ancla de voz (`?panel=gastos`) va
          en un wrapper: las 3 vistas (Resumen/Detalle/Histórico) se excluyen. */}
      <Solo visible={ver("gastos")}>
      {gastosMiniPanel}
      <div data-panel="gastos">
      {tabGastos === "resumen" ? (
        <DonutChart
          encabezado={gastosPanelTabs}
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
      ) : (
        <EvolutionChart
          encabezado={gastosPanelTabs}
          currency={data.monedaPredeterminadaISO}
          data={filteredEvolucion}
          color="var(--primary)"
          area
        />
      )}
      </div>

      {/* **Listado de gastos**, debajo del panel: desde el **2026-10-03** es el
          listado **COMPLETO** (búsqueda + scroll infinito), el mismo que se ve en
          `/gastos` — reemplaza a las tarjetas de los últimos 3 días y al botón
          "Ver más gastos". Así la pantalla Gastos tiene la **misma resolución que
          Ingresos** (que lista todos los períodos de trabajo).
          ⚠️ **Sin título** (pedido del usuario): el panel arranca con el buscador.
          La primera tanda viene del server (`gastosPrimeraPagina`); las siguientes
          las pide `GastosClient` con `getGastosPaginaAction`. */}
      {gastosPrimeraPagina && (
        <GastosClient
          embebido
          primeraPagina={gastosPrimeraPagina}
          monedaISO={data.monedaPredeterminadaISO}
          // Mismos filtros que el mini-panel y el gráfico, **sin** las fechas.
          filtros={{ categorias: selCat, cuentas: selCta }}
        />
      )}
      </Solo>

      <Solo visible={ver("ingresos")}>
      {ingresosMiniPanel}
      <div data-panel="ingresos">
      {tabIngresos === "resumen" ? (
        <DonutChart
          encabezado={ingresosPanelTabs}
          currency={data.monedaPredeterminadaISO}
          data={filteredIngresosResumen.map((i) => ({ name: i.name, value: i.value }))}
          invertTrend
          compare={esMesActualIngresos ? {
            prevTotal: ingresosPrevTotal,
            prevByName: Object.fromEntries(ingresosMesAnterior),
          } : null}
        />
      ) : (
        <EvolutionChart
          encabezado={ingresosPanelTabs}
          data={filteredIngresosEvolucion}
          color="var(--primary)"
          area
          currency={data.monedaPredeterminadaISO}
        />
      )}
      </div>

      {/* Grilla unificada de trabajo (pendientes + cobradas con scroll infinito):
          el **filtro de trabajo** del mini-panel la acota (los pendientes en memoria
          y las cobradas contra el server). Las fechas NO la afectan. */}
      {trabajo && (
        <TrabajoClient
          embebido
          estimacionesSSR={data.cobrosEstimados}
          hoyServidor={data.hoyServidor}
          ingresosDetalle={data.ingresosDetalle}
          pendientes={trabajo.pendientes}
          cobradosIniciales={trabajo.cobradosIniciales}
          hayMasCobrados={trabajo.hayMasCobrados}
          totalCobrados={trabajo.totalCobrados}
          cuentas={trabajo.cuentas}
          monedaISO={trabajo.monedaISO}
          filtroTrabajos={selTra}
        />
      )}
      </Solo>

      {/* Panel **Resultados**: se renderiza SIEMPRE (decisión del usuario
          2026-10-01) — si no hay datos, `EvolutionChart` muestra su estado vacío
          ("Sin datos disponibles") con su título y su badge. Así el ancla de voz
          `data-panel="resultados"` **existe siempre** (antes, sin datos, el
          panel no se montaba y el scroll a ese panel no tenía destino). */}
      <Solo visible={ver("resultados")}>
      <div data-panel="resultados">
      <EvolutionChart
        encabezado={resultadosPanelHeader}
        data={data.evolucionResultados}
        color="var(--primary)"
        area
        currency={data.monedaPredeterminadaISO}
      />
      </div>
      </Solo>

      {/* Panel de préstamos: se muestra SIEMPRE (también sin préstamos
          cargados; en ese caso PrestamosChart muestra su estado vacío). */}
      <Solo visible={ver("prestamos")}>
      <div data-panel="prestamos">
      <PrestamosChart
        encabezado={prestamosPanelHeader}
        data={data.prestamosChart.data}
        series={data.prestamosChart.series}
      />
      </div>
      </Solo>

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
    </div>
  );
}
