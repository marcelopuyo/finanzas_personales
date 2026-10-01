"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
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
import { GastosTarjetas } from "./components/gastos-tarjetas";
import { IngresosTarjetas } from "./components/ingresos-tarjetas";
import { PeriodosTrabajoLista } from "./components/periodos-trabajo-lista";
import type { DashboardData } from "./dashboard-data";
import { gastosEvolucionPor } from "./gastos-agrupacion";
import {
  evolucionIngresosPorMes,
  ingresosDelMesActual,
  ingresosEnRango,
} from "./ingresos-helpers";
import { aFuenteIngresos } from "@/backend/src/lib/ingresos-trabajo";
import type { GastoOut } from "@/backend/src/queries/gastos";
import type { LiquidacionOut } from "@/backend/src/queries/trabajos";
import { cn, numberToCurrency, todayLocalISODate } from "@/lib/utils";
import { useMontado } from "@/lib/use-cliente";
import { usePendingNav, usePrefetchNav } from "@/components/ui/nav-progress";
import { useTap } from "@/lib/tap";

interface Props {
  data: DashboardData;
}

const SIN_CATEGORIA = "Sin categoría";
const SIN_CUENTA = "Sin cuenta";
/** Destino del PANEL "Trabajo" completo (ver `DashboardClient`): la pantalla
    `/trabajo`, con los pendientes por trabajo arriba y los cobrados abajo. */
const HREF_TRABAJO = "/trabajo";
const SIN_TRABAJO = "Sin trabajo";

function toDateKey(v: string | Date | null | undefined): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

export function DashboardClient({ data }: Props) {
  // ── Navegación del panel "Trabajo" (todo el panel, salvo el ⋯) ──────────
  // ⚠️ Se dispara con **`useTap`** (touch events + click), NO con `onClick`: en
  // iOS un toque sobre una zona grande puede no generar `click` (el navegador lo
  // clasifica como scroll y lo descarta) y la acción se perdía ⇒ había que tocar
  // 2-3 veces. Ver `lib/tap.ts` y §118 de la bitácora.
  const { go: navGo } = usePendingNav();
  const prefetch = usePrefetchNav();
  const abrirTrabajo = () => navGo(HREF_TRABAJO, "trabajo");
  const tap = useTap(abrirTrabajo);
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

  // Acciones de la cabecera de "Gastos".
  //
  // En MOBILE el panel tiene DOS filas: fila 1 = título + badge + **⋯** (en el
  // ángulo superior derecho; el ⋯ lo aporta la propia fila del título, ver
  // `gastosMenuMobile`) y fila 2 = pestañas + **Filtros** (pegado al borde derecho
  // con `ml-auto`). En desktop van todos en UNA fila, a la derecha del badge
  // (`sm:w-auto`): Filtros · pestañas · ⋯.
  //
  // ⚠️ La pestaña **Detalle** no tiene Filtros (la búsqueda vive en la pantalla
  // "Ver más gastos"), pero **sí** el badge "Mes actual" y el ⋯: mismo esqueleto de
  // dos filas que las otras dos (si no, el ⋯ saltaba a la fila 2 al cambiar de
  // pestaña y el badge desaparecía).
  const gastosHeaderActions = (conFiltros = true) => (
    <div className="flex w-full items-center gap-1 sm:w-auto sm:gap-2">
      {conFiltros && filterBtn("hidden sm:inline-flex")}
      {gastosTabs}
      {conFiltros && filterBtn("ml-auto sm:hidden")}
      {/* En mobile el ⋯ vive en la fila 1 (ver `gastosMenuMobile`). */}
      <div className="ml-auto hidden sm:flex">
        <GastosActionsMenu />
      </div>
    </div>
  );

  /**
   * ⋯ del panel Gastos en **MOBILE**: va en la **fila 1**, pegado al borde derecho.
   * Lo aporta el `badge` en Resumen/Histórico (esa fila la arma el gráfico) y
   * `gastosFilaTitulo` en Detalle. En desktop el ⋯ viaja con las pestañas, así que
   * esta copia se oculta (`sm:hidden`).
   */
  const gastosMenuMobile = (
    <div className="ml-auto flex items-center sm:hidden">
      <GastosActionsMenu />
    </div>
  );

  /**
   * Fila 1 en **mobile** para la pestaña **Detalle**: el título del panel + el
   * badge "Mes actual" + el ⋯ en el ángulo superior derecho. Es la MISMA fila que
   * arman Resumen/Histórico (título + badge + ⋯, dentro del gráfico) así que **ni el
   * badge ni el ⋯ se mueven** al cambiar de pestaña (mismo valor de `badges.gastos`:
   * gastos con `fechaPago` dentro del mes en curso). En desktop vuelve a
   * shrink-to-fit y el ⋯ lo pone `gastosHeaderActions`.
   */
  const gastosFilaTitulo = (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <h3 className="text-[16px] font-semibold text-header">Gastos</h3>
      <StatBadge label="Mes actual" value={badges.gastos} />
      {gastosMenuMobile}
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
      <div
        data-panel="balance"
        className="relative flex min-h-31.75 items-center justify-center rounded-lg border border-border bg-card p-4 shadow-sm"
      >
        {/* Rótulo en el ángulo superior izquierdo, como el título de las
            tarjetas de cuentas (dentro del mismo padding p-4). */}
        <p className="absolute left-4 top-4 text-[16px] font-semibold text-header">Balance Actual</p>
        <p className="text-3xl font-semibold tracking-tight text-success">
          {numberToCurrency(data.balance, data.monedaPredeterminadaISO)}
        </p>
      </div>

      {/* Panel Cuentas — solo cuentas reales (el toque abre la pantalla de sus
          movimientos, `/cuentas/[id]`). El panel usa bg-card como el resto; las
          tarjetas internas van en bg-muted. */}
      <div data-panel="cuentas" className="rounded-lg border border-border bg-card p-4 sm:p-5">
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

      {/* Panel Trabajo — ítems PENDIENTES de cobro (jornadas/tareas sin
          liquidar) repartidos en las **tandas estimadas** de cada trabajo:
          "Por cobrar" (la ventana ya cerró) · "En curso" · "Sin período
          estimado" (decisión del usuario 2026-09-27, opción C del preview).
          La inferencia la hace el server (`lib/cobros-estimados.ts`).
          ⚠️ **El PANEL ENTERO es el área de clic** (decisión del usuario
          2026-09-17) y navega a la pantalla `/trabajo` (2026-09-26: antes llevaba
          al CRUD de períodos, que se archivó con el rediseño) — ahí están los
          pendientes por trabajo y, abajo, TODOS los cobrados. El menú ⋯ queda
          EXCLUIDO porque se monta FUERA del área clickeable (es un hermano que
          flota sobre la esquina). El toque usa `useTap` porque en iOS el primer
          toque de una zona grande puede no generar `click` (§118). */}
      <div data-panel="trabajo" className="relative">
        <div
          role="link"
          tabIndex={0}
          {...tap}
          onKeyDown={(e) => {
            if (e.key === "Enter") abrirTrabajo();
          }}
          // Prefetch del destino al primer contacto: la llegada sigue siendo
          // instantánea.
          onPointerEnter={() => prefetch(HREF_TRABAJO)}
          onTouchStartCapture={() => prefetch(HREF_TRABAJO)}
          className="cursor-default select-none rounded-lg border border-border bg-card p-4 [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] sm:p-5"
        >
          {/* Encabezado: título a la izquierda (el ⋯ va FUERA de esta caja, ver
              abajo, para que su toque no dispare la navegación del panel). */}
          <div className="mb-3 pr-8">
            <h2 className="text-[16px] font-semibold text-header">Trabajo</h2>
          </div>
          <PeriodosTrabajoLista
            estimaciones={data.cobrosEstimados}
            currency={data.monedaPredeterminadaISO}
          />
        </div>
        {/* Menú ⋯ del panel: HERMANO de la caja clickeable (no hijo) y flotando
            sobre su esquina superior derecha, alineado con el padding del panel.
            Así el toque del menú nunca forma parte de la navegación del panel. */}
        <div className="absolute right-4 top-4 z-10 flex items-center sm:right-5 sm:top-5">
          <TrabajosActionsMenu />
        </div>
      </div>

      {/* Gastos Section — filtro compartido. El ancla de voz (`?panel=gastos`) va
          en un wrapper: las 3 vistas (Resumen/Detalle/Histórico) se excluyen. */}
      <div data-panel="gastos">
      {tabGastos === "resumen" ? (
        <DonutChart
          title="Gastos"
          action={gastosHeaderActions()}
          badge={<><StatBadge label="Mes actual" value={badges.gastos} />{gastosMenuMobile}</>}
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
          {/* Cabecera de "Gastos → Detalle": MISMA estructura de dos filas que
              Resumen/Histórico (fila 1 = título + badge "Mes actual" + ⋯ en el ángulo
              superior derecho; fila 2 = pestañas) para que ni el badge ni el ⋯ se
              muevan al cambiar de pestaña. Esta pestaña NO lleva Filtros ni
              buscador: el Detalle muestra los últimos 3 días en tarjetas
              (2026-09-30) y la búsqueda vive en la pantalla "Ver más gastos". */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            {gastosFilaTitulo}
            {gastosHeaderActions(false)}
          </div>
          <GastosTarjetas
            data={todosLosGastos}
            hoyServidor={data.hoyServidor}
            currency={data.monedaPredeterminadaISO}
          />
        </div>
      ) : (
        <EvolutionChart
          title="Gastos"
          action={gastosHeaderActions()}
          badge={<><StatBadge label="Mes actual" value={badges.gastos} />{gastosMenuMobile}</>}
          currency={data.monedaPredeterminadaISO}
          data={filteredEvolucion}
          color="var(--primary)"
          area
        />
      )}
      </div>

      {/* Ingresos Section — filtro compartido (mismo criterio de ancla). */}
      <div data-panel="ingresos">
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
          {/* Cabecera de "Ingresos → Detalle": MISMA estructura de dos filas que
              Resumen/Histórico (fila 1 = título + badge "Mes actual"; fila 2 =
              pestañas) para que el badge no se mueva al cambiar de pestaña. Esta
              pestaña NO lleva Filtros (la ventana de 3 meses es fija): los
              Filtros de Ingresos siguen en Resumen e Histórico. */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[16px] font-semibold text-header">Ingresos</h3>
              <StatBadge label="Mes actual" value={badges.ingresos} />
            </div>
            <div className="flex items-center gap-2">{ingresosTabs}</div>
          </div>
          <IngresosTarjetas
            liquidaciones={todosLosIngresos}
            itemsPendientes={data.itemsPendientes}
            hoyServidor={data.hoyServidor}
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
      </div>

      {/* Panel **Resultados**: se renderiza SIEMPRE (decisión del usuario
          2026-10-01) — si no hay datos, `EvolutionChart` muestra su estado vacío
          ("Sin datos disponibles") con su título y su badge. Así el ancla de voz
          `data-panel="resultados"` **existe siempre** (antes, sin datos, el
          panel no se montaba y el scroll a ese panel no tenía destino). */}
      <div data-panel="resultados">
      <EvolutionChart
        title="Resultados"
        badge={<StatBadge label="Mes actual" value={badges.resultados} />}
        data={data.evolucionResultados}
        color="var(--primary)"
        area
        currency={data.monedaPredeterminadaISO}
      />
      </div>

      {/* Panel de préstamos: se muestra SIEMPRE (también sin préstamos
          cargados; en ese caso PrestamosChart muestra su estado vacío). */}
      <div data-panel="prestamos">
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
      </div>

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
