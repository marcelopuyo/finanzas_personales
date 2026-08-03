"use client";

import { useEffect, useState } from "react";
import { StatCard, StatCardSkeleton } from "@/components/ui/stat-card";
import { StatBadge } from "@/components/ui/stat-badge";
import { Tabs } from "@/components/ui/tabs";
import { ChartSkeleton } from "@/components/ui/skeleton";
import { AccountCard, AccountCardSkeleton } from "./components/account-card";
import { StackedBarChart } from "./components/bar-chart";
import { EvolutionChart } from "./components/line-chart";
import { GastosDetalle } from "./components/gastos-detalle";
import { IngresosDetalle } from "./components/ingresos-detalle";
import {
  fetchDashboardData,
  type DashboardData,
} from "./dashboard-data";
import { numberToCurrency } from "@/lib/utils";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabGastos, setTabGastos] = useState("resumen");
  const [tabIngresos, setTabIngresos] = useState("resumen");

  useEffect(() => {
    fetchDashboardData()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-danger">
            Error al cargar los datos
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchDashboardData()
                .then(setData)
                .catch((err) => setError(err.message))
                .finally(() => setLoading(false));
            }}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

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
      {/* Header */}
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight text-header">
          Dashboard
        </h1>
        <p className="mt-0.5 text-[13px] text-subtitle">
          Resumen de tus finanzas personales
        </p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : data ? (
          <>
            <StatCard
              title="Balance Actual"
              value={numberToCurrency(data.balance)}
            />
            <StatCard
              title="Ingresos Totales"
              value={data.ingresosTotal}
              trend="up"
            />
            <StatCard
              title="Gastos del Período"
              value={data.gastosTotal}
              subtitle={`Pendiente: ${data.gastosSaldo}`}
              trend="down"
            />
            <StatCard
              title="Préstamos"
              value={data.prestamosSaldo}
              subtitle={`Total: ${data.prestamosTotal}`}
              trend="neutral"
            />
          </>
        ) : null}
      </div>

      {/* Account Cards */}
      <div>
        <h2 className="mb-3 text-[14px] font-medium text-header">
          Cuentas y Períodos
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <>
              <AccountCardSkeleton />
              <AccountCardSkeleton />
              <AccountCardSkeleton />
              <AccountCardSkeleton />
            </>
          ) : data ? (
            data.cuentas.map((cuenta, i) => (
              <AccountCard key={i} {...cuenta} />
            ))
          ) : null}
        </div>
      </div>

      {/* Gastos Section */}
      {loading ? (
        <ChartSkeleton />
      ) : data ? (
        tabGastos === "resumen" ? (
          <StackedBarChart
            title="Gastos"
            action={gastosTabs}
            badge={
              <StatBadge label="Total actual" value={data.gastosTotal} />
            }
            data={data.gastosResumen.map((g) => ({
              name: g.name,
              value: g.pagado,
              value2: g.saldo,
            }))}
            bars={[
              {
                key: "value",
                name: "Pagado",
                color: "var(--success)",
                darkColor: "var(--success)",
              },
              {
                key: "value2",
                name: "Pendiente",
                color: "var(--warning)",
                darkColor: "var(--warning)",
              },
            ]}
          />
        ) : tabGastos === "detalle" ? (
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-semibold text-header">
                  Gastos
                </h3>
                <StatBadge label="Total actual" value={data.gastosTotal} />
              </div>
              {gastosTabs}
            </div>
            <GastosDetalle data={data.gastosDetalle} />
          </div>
        ) : (
          <EvolutionChart
            title="Gastos"
            action={gastosTabs}
            badge={
              <StatBadge label="Total actual" value={data.gastosTotal} />
            }
            data={data.evolucionGastos}
            color="var(--danger)"
          />
        )
      ) : null}

      {/* Ingresos Section */}
      {loading ? (
        <ChartSkeleton />
      ) : data ? (
        tabIngresos === "resumen" ? (
          <StackedBarChart
            title="Ingresos"
            action={ingresosTabs}
            data={data.ingresosResumen.map((i) => ({
              name: i.name,
              value: i.value,
            }))}
            bars={[
              {
                key: "value",
                name: "Ingresos",
                color: "var(--success)",
                darkColor: "var(--success)",
              },
            ]}
          />
        ) : tabIngresos === "detalle" ? (
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-semibold text-header">
                  Ingresos
                </h3>
              </div>
              {ingresosTabs}
            </div>
            <IngresosDetalle data={data.ingresosDetalle} />
          </div>
        ) : (
          <EvolutionChart
            title="Ingresos"
            action={ingresosTabs}
            data={data.evolucionIngresos}
            color="var(--success)"
          />
        )
      ) : null}

      {/* Evolución Resultados */}
      {loading ? (
        <ChartSkeleton />
      ) : data && data.evolucionResultados.length > 0 ? (
        <EvolutionChart
          title="Evolución de Resultados"
          data={data.evolucionResultados}
          color="var(--primary)"
          area
        />
      ) : null}

      {/* Préstamos */}
      {loading ? (
        <ChartSkeleton />
      ) : data && data.prestamosResumen.length > 0 ? (
        <StackedBarChart
          title="Préstamos Pendientes"
          data={data.prestamosResumen.map((p) => ({
            name: p.name,
            value: p.pagado,
            value2: p.saldo,
          }))}
          bars={[
            {
              key: "value",
              name: "Pagado",
              color: "var(--success)",
              darkColor: "var(--success)",
            },
            {
              key: "value2",
              name: "Pendiente",
              color: "var(--danger)",
              darkColor: "var(--danger)",
            },
          ]}
        />
      ) : null}
    </div>
  );
}
