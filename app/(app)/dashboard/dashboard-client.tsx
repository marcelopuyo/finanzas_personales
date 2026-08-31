"use client";

import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { StatBadge } from "@/components/ui/stat-badge";
import { Tabs } from "@/components/ui/tabs";
import { Modal } from "@/components/ui/modal";
import { Checkbox } from "@/components/ui/checkbox";
import { AccountCard } from "./components/account-card";
import { DonutChart } from "./components/donut-chart";
import { EvolutionChart } from "./components/line-chart";
import { PrestamosChart } from "./components/prestamos-chart";
import { GastosDetalle } from "./components/gastos-detalle";
import { IngresosDetalle } from "./components/ingresos-detalle";
import { HistorialModal, type CuentaHistorial } from "./components/historial-modal";
import { PeriodosModal, type TipoPeriodos } from "./components/periodos-modal";
import type { DashboardData } from "./dashboard-data";
import type { GastoOut } from "@/backend/src/queries/gastos";
import type { PeriodoTrabajoOut } from "@/backend/src/queries/trabajos";
import { cn, numberToCurrency, todayLocalISODate } from "@/lib/utils";

interface Props {
  data: DashboardData;
}

const SIN_CATEGORIA = "Sin categoría";
const SIN_CUENTA = "Sin cuenta";
const SIN_TRABAJO = "Sin trabajo";

function toDateKey(v: string | Date | null | undefined): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

export function DashboardClient({ data }: Props) {
  const [tabGastos, setTabGastos] = useState("resumen");
  const [tabIngresos, setTabIngresos] = useState("resumen");
  // Cuenta seleccionada para abrir su historial en popup
  const [cuentaHist, setCuentaHist] = useState<CuentaHistorial | null>(null);
  // Popup de las tarjetas sintéticas de períodos (a cobrar / actuales).
  const [periodosModal, setPeriodosModal] = useState<TipoPeriodos | null>(null);

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
  const todosLosIngresos: PeriodoTrabajoOut[] = data.ingresosDetalle;

  const hoy = todayLocalISODate();

  // Listados de períodos para los popups de las tarjetas sintéticas:
  // - "Períodos a Cobrar": cerrados (fecha final < hoy) y no cobrados.
  // - "Períodos Actuales": no cobrados, ya comenzados (desde <= hoy) y con
  //   fecha final >= hoy (misma condición que la tarjeta del dashboard).
  const periodosCobrar = useMemo(
    () =>
      todosLosIngresos
        .filter((p) => {
          const noCobrado =
            !p.fechaDeCobro || toDateKey(p.fechaDeCobro) < "1901-01-02";
          return noCobrado && toDateKey(p.fechaHasta) < hoy;
        })
        .sort((a, b) =>
          toDateKey(b.fechaHasta).localeCompare(toDateKey(a.fechaHasta))
        ),
    [todosLosIngresos, hoy]
  );

  const periodosActuales = useMemo(
    () =>
      todosLosIngresos
        .filter((p) => {
          const noCobrado =
            !p.fechaDeCobro || toDateKey(p.fechaDeCobro) < "1901-01-02";
          // Misma condición que la tarjeta "Períodos Actuales" del dashboard:
          // no cobrado, ya comenzado (desde <= hoy) y no terminado (hasta >= hoy).
          return (
            noCobrado &&
            toDateKey(p.fechaHasta) >= hoy &&
            toDateKey(p.fechaDesde) <= hoy
          );
        })
        .sort((a, b) =>
          toDateKey(a.fechaHasta).localeCompare(toDateKey(b.fechaHasta))
        ),
    [todosLosIngresos, hoy]
  );

  // Tarjetas sintéticas de períodos ("Períodos a Cobrar"/"Períodos Actuales"):
  // se calculan en el cliente DESPUÉS del montaje para que el "hoy" sea el del
  // navegador (el del servidor puede correrse ±1 día si corre en otra zona
  // horaria, ej. Vercel en UTC con usuario en GMT-3 de noche). Durante el SSR y
  // el primer render se muestran solo las cuentas reales; al montar se agregan
  // las sintéticas (sin romper la hidratación).
  const [sinteticas, setSinteticas] = useState<DashboardData["cuentas"]>([]);
  useEffect(() => {
    const pendiente = periodosCobrar.reduce(
      (acc, p) => acc + (p.montoACobrar || 0),
      0
    );
    const actual = periodosActuales.reduce(
      (acc, p) => acc + (p.montoACobrar || 0),
      0
    );
    const cards: DashboardData["cuentas"] = [];
    if (pendiente > 0) {
      cards.push({
        title: "Períodos a Cobrar",
        value: numberToCurrency(pendiente, data.monedaPredeterminadaISO),
        labels: [],
        values: [],
        // Menú con "Cobro Sueldo" (cobrar los períodos pendientes).
        menuAccion: "cobro",
      });
    }
    if (periodosActuales.length > 0) {
      cards.push({
        title: "Períodos Actuales",
        value: numberToCurrency(actual, data.monedaPredeterminadaISO),
        labels: [],
        values: [],
        // Menú con "Jornada trabajo" (agregar jornadas a los períodos actuales).
        menuAccion: "jornada",
      });
    }
    setSinteticas(cards);
  }, [data.monedaPredeterminadaISO, periodosCobrar, periodosActuales]);

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

  // Evolución filtrada (sin fechas, para el panel Histórico):
  // agrupa por período y suma montos, ordenado cronológicamente.
  const filteredEvolucion = useMemo(() => {
    const map = new Map<string, number>();
    filteredSinFecha.forEach((g) => {
      const nombre = g.periodo?.nombre || "Sin período";
      map.set(nombre, (map.get(nombre) || 0) + g.monto);
    });
    const MESES: Record<string, number> = {
      enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,
      julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12,
    };
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        const [ma] = a.name.toLowerCase().split(" ");
        const [mb] = b.name.toLowerCase().split(" ");
        return (MESES[ma] ?? 99) - (MESES[mb] ?? 99);
      });
  }, [filteredSinFecha]);

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
    setDCat(selCat); setDCta(selCta); setDFd(selFd); setDFh(selFh); setOpen(true);
  };
  const apply = () => {
    setSelCat(dCat); setSelCta(dCta); setSelFd(dFd); setSelFh(dFh); setOpen(false);
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
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
        activeFilters > 0
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-muted text-card-foreground hover:bg-card",
        className
      )}
    >
      <SlidersHorizontal className="h-3.5 w-3.5" />
      Filtros
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

  const trabajos = useMemo(
    () =>
      [
        ...new Set(todosLosIngresos.map((p) => p.trabajo?.nombre || SIN_TRABAJO)),
      ].sort(),
    [todosLosIngresos]
  );

  // Detalle: trabajo + fechas (la fecha usa la columna "desde")
  const filteredIngresos = useMemo(() => {
    let r = todosLosIngresos;
    if (selTra.length > 0)
      r = r.filter((p) => selTra.includes(p.trabajo?.nombre || SIN_TRABAJO));
    if (selFdIng) r = r.filter((p) => toDateKey(p.fechaDesde) >= selFdIng);
    if (selFhIng) r = r.filter((p) => toDateKey(p.fechaDesde) <= selFhIng);
    return r;
  }, [todosLosIngresos, selTra, selFdIng, selFhIng]);

  // Histórico: solo trabajo (sin fechas)
  const filteredIngresosSinFechaIng = useMemo(() => {
    let r = todosLosIngresos;
    if (selTra.length > 0)
      r = r.filter((p) => selTra.includes(p.trabajo?.nombre || SIN_TRABAJO));
    return r;
  }, [todosLosIngresos, selTra]);

  // Resumen por trabajo: filtra las JORNADAS por su fechaJornada (la fecha
  // afecta al resumen, pero el trabajo no). Con fechas vacías muestra todo.
  const filteredIngresosResumen = useMemo(() => {
    const map = new Map<string, number>();
    todosLosIngresos.forEach((p) => {
      const nombre = p.trabajo?.nombre || SIN_TRABAJO;
      (p.jornadas ?? []).forEach((j) => {
        const f = toDateKey(j.fechaJornada);
        if (selFdIng && f < selFdIng) return;
        if (selFhIng && f > selFhIng) return;
        map.set(nombre, (map.get(nombre) || 0) + (j.montoJornada || 0) + (j.montoPropina || 0));
      });
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [todosLosIngresos, selFdIng, selFhIng]);

  // Histórico por mes (desde las jornadas de los períodos filtrados por trabajo)
  const filteredIngresosEvolucion = useMemo(() => {
    const map = new Map<string, number>();
    filteredIngresosSinFechaIng.forEach((p) => {
      (p.jornadas ?? []).forEach((j) => {
        const d = new Date(j.fechaJornada);
        d.setUTCHours(12, 0, 0, 0); // mismo criterio que el backend (evita corrimiento por timezone)
        const mes = d.toLocaleDateString("es-ES", { month: "short" });
        const key = `${mes}-${d.getFullYear()}`;
        map.set(key, (map.get(key) || 0) + (j.montoJornada || 0) + (j.montoPropina || 0));
      });
    });
    const MESES_ORD: Record<string, number> = {
      ene:1,feb:2,mar:3,abr:4,may:5,jun:6,
      jul:7,ago:8,sept:9,oct:10,nov:11,dic:12,
    };
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        const [ma, ya] = a.name.split("-");
        const [mb, yb] = b.name.split("-");
        return (Number(ya) * 12 + (MESES_ORD[ma] ?? 0)) - (Number(yb) * 12 + (MESES_ORD[mb] ?? 0));
      });
  }, [filteredIngresosSinFechaIng]);

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
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
        activeIngFilters > 0
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-muted text-card-foreground hover:bg-card",
        className
      )}
    >
      <SlidersHorizontal className="h-3.5 w-3.5" />
      Filtros
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
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight text-header">Resumen</h1>
        <p className="mt-0.5 text-[13px] text-subtitle">Resumen de tus finanzas personales</p>
      </div>

      <StatCard
        title="Balance Actual"
        value={numberToCurrency(data.balance, data.monedaPredeterminadaISO)}
        centered
        className="border-primary/40 bg-linear-to-br from-primary/10 via-card to-card shadow-sm"
      />

      <div>
        <h2 className="mb-3 text-[14px] font-medium text-header">Cuentas y Períodos</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...data.cuentas, ...sinteticas].map((cuenta, i) => (
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
                } else if (cuenta.menuAccion === "cobro") {
                  setPeriodosModal("cobrar");
                } else if (cuenta.menuAccion === "jornada") {
                  setPeriodosModal("actuales");
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* Gastos Section — filtro compartido */}
      {tabGastos === "resumen" ? (
        <DonutChart
          title="Gastos"
          action={<div className="flex items-center gap-2">{filterBtn("hidden sm:inline-flex")}{gastosTabs}</div>}
          badge={<><StatBadge label="Mes actual" value={data.gastosTotal} />{filterBtn("sm:hidden")}</>}
          currency={data.monedaPredeterminadaISO}
          data={filteredResumen.map((g) => ({
            name: g.name,
            value: g.pagado + g.saldo,
            meta: [
              { label: "Pagado", value: g.pagado },
              { label: "Pendiente", value: g.saldo },
            ],
          }))}
        />
      ) : tabGastos === "detalle" ? (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[16px] font-semibold text-header">Gastos</h3>
              <StatBadge label="Mes actual" value={data.gastosTotal} />
              {filterBtn("sm:hidden")}
            </div>
            <div className="flex items-center gap-2">{filterBtn("hidden sm:inline-flex")}{gastosTabs}</div>
          </div>
          <GastosDetalle
            data={filteredGastos}
            total={todosLosGastos.length}
            currency={data.monedaPredeterminadaISO}
          />
        </div>
      ) : (
        <EvolutionChart
          title="Gastos"
          action={<div className="flex items-center gap-2">{filterBtn("hidden sm:inline-flex")}{gastosTabs}</div>}
          badge={<><StatBadge label="Mes actual" value={data.gastosTotal} />{filterBtn("sm:hidden")}</>}
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
          badge={<><StatBadge label="Mes actual" value={data.ingresosMesActual} />{ingFilterBtn("sm:hidden")}</>}
          currency={data.monedaPredeterminadaISO}
          data={filteredIngresosResumen.map((i) => ({ name: i.name, value: i.value }))}
        />
      ) : tabIngresos === "detalle" ? (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[16px] font-semibold text-header">Ingresos</h3>
              <StatBadge label="Mes actual" value={data.ingresosMesActual} />
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
          badge={<><StatBadge label="Mes actual" value={data.ingresosMesActual} />{ingFilterBtn("sm:hidden")}</>}
          data={filteredIngresosEvolucion}
          color="var(--primary)"
          area
          currency={data.monedaPredeterminadaISO}
        />
      )}

      {data.evolucionResultados.length > 0 && (
        <EvolutionChart
          title="Evolución de Resultados"
          data={data.evolucionResultados}
          color="var(--primary)"
          area
          currency={data.monedaPredeterminadaISO}
        />
      )}

      {data.prestamosChart.data.length > 0 && (
        <PrestamosChart
          title="Préstamos Pendientes"
          badge={
            <div className="flex flex-wrap items-center gap-2">
              {data.prestamosTotales.map((t) => (
                <StatBadge key={t.currency} label={t.currency} value={t.value} />
              ))}
            </div>
          }
          data={data.prestamosChart.data}
          series={data.prestamosChart.series}
        />
      )}

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
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-subtitle">Desde</span>
            <input type="date" value={dFd} onChange={(e) => setDFd(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-[13px] text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-subtitle">Hasta</span>
            <input type="date" value={dFh} onChange={(e) => setDFh(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-[13px] text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
        </div>
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
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-subtitle">Desde</span>
            <input type="date" value={dFdIng} onChange={(e) => setDFdIng(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-[13px] text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-subtitle">Hasta</span>
            <input type="date" value={dFhIng} onChange={(e) => setDFhIng(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-[13px] text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
        </div>
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
