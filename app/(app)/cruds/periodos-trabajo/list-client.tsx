"use client";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { CrudTable } from "@/components/crud/CrudTable";
import type { PeriodoTrabajoOut } from "@/backend/src/queries/trabajos";
import { eliminarPeriodoTrabajo } from "@/backend/src/actions/trabajos";
import { ActividadCell } from "@/app/(app)/dashboard/components/ingresos-detalle";
import type { ColumnDef } from "@tanstack/react-table";
import { dateTimeToString, numberToCurrency } from "@/lib/utils";

/** Un trabajo es "compatible" con el gráfico de actividad según su modalidad de
    cobro: horas_variables → jornadas · por_tarea → tareas. Los fijo/horas_fijas
    no admiten cargas de jornadas/tareas, así que no muestran gráfico (solo "—"). */
function esCompatibleConActividad(p: PeriodoTrabajoOut): boolean {
  if (!p.trabajo) return false;
  // Sin modalidad (registros previos a la migración) se asume horas_variables.
  const m = p.trabajo.modalidadCobro ?? "horas_variables";
  return m === "horas_variables" || m === "por_tarea";
}

/** Total de actividad del período (jornadas+propina, o tareas). Lo usa la
    exportación a PDF de la columna de gráfico. */
function totalActividad(p: PeriodoTrabajoOut): number {
  if ((p.jornadas?.length ?? 0) > 0)
    return (p.jornadas ?? []).reduce(
      (suma, j) => suma + (j.montoJornada || 0) + (j.montoPropina || 0),
      0
    );
  if ((p.tareas?.length ?? 0) > 0)
    return (p.tareas ?? []).reduce((suma, t) => suma + (t.montoTarea || 0), 0);
  return 0;
}

// El nombre del trabajo va PRIMERO (decisión 2026-09-07). El orden de las filas
// no depende de la posición de las columnas: lo define el query del server
// (getAllPeriodosTrabajo), que ya ordena por fechaDesde DESC, así que se
// mantiene decreciente por "Desde" aunque "Trabajo" quede como 1ª columna.
function periodoTrabajoColumns(
  currency: string
): ColumnDef<PeriodoTrabajoOut>[] {
  return [
    {
      accessorFn: (r) => r.trabajo?.nombre ?? "",
      id: "trabajo",
      header: "Trabajo",
    },
    {
      accessorKey: "fechaDesde",
      header: "Desde",
      cell: ({ getValue }) => dateTimeToString(getValue<Date>()),
      meta: { align: "center" as const },
    },
    {
      accessorKey: "fechaHasta",
      header: "Hasta",
      cell: ({ getValue }) => dateTimeToString(getValue<Date>()),
      meta: { align: "center" as const },
    },
    {
      accessorKey: "montoACobrar",
      header: "A Cobrar",
      meta: { align: "right" as const, isCurrency: true },
      cell: ({ getValue }) =>
        numberToCurrency(getValue<number>() ?? 0, currency),
    },
    {
      accessorKey: "fechaDeCobro",
      header: "Cobrado",
      cell: ({ getValue }) =>
        dateTimeToString(getValue<Date | null>() ?? undefined),
      meta: { align: "center" as const },
    },
    {
      id: "actividad",
      header: "Jornadas/Tareas",
      meta: {
        align: "center" as const,
        exportValue: (row: PeriodoTrabajoOut) =>
          esCompatibleConActividad(row) && totalActividad(row) > 0
            ? numberToCurrency(totalActividad(row), currency)
            : "",
      },
      cell: ({ row }) =>
        esCompatibleConActividad(row.original) ? (
          <ActividadCell
            jornadas={row.original.jornadas}
            tareas={row.original.tareas}
            currency={currency}
          />
        ) : (
          <span className="text-subtitle">—</span>
        ),
    },
  ];
}

interface Props {
  initialData: PeriodoTrabajoOut[];
  /** Origen de navegación (?origen=...). Si es "dashboard" se propaga al
      "+" (wizard de nuevo período) y al editar. La flecha volver al dashboard
      es SIEMPRE visible. */
  origen?: string;
  /** ISO 4217 de la moneda predeterminada del usuario: gráfico de actividad
      (tooltips) y montos de la grilla/PDF (mismo criterio que el dashboard de
      ingresos y el CRUD de gastos). */
  currency?: string;
}
export function PeriodosTrabajoListClient({
  initialData,
  origen,
  currency = "USD",
}: Props) {
  const router = useRouter();
  // Flecha "volver al dashboard" SIEMPRE visible. Al venir del panel Trabajo
  // (?origen=dashboard) se propaga el origen para que el "+" (wizard) mantenga
  // el viaje de ida y vuelta al dashboard.
  const desdeDashboard = origen === "dashboard";
  const origenQ = desdeDashboard ? "?origen=dashboard" : "";
  return (
    <CrudTable<PeriodoTrabajoOut>
      title="Períodos de Trabajo"
      columns={periodoTrabajoColumns(currency)}
      initialData={initialData}
      currency={currency}
      deleteItem={eliminarPeriodoTrabajo}
      createHref={`/cruds/periodos-trabajo/nuevo${origenQ}`}
      editHref={(id) => `/cruds/periodos-trabajo/${id}/editar${origenQ}`}
      getId={(i) => i.id}
      searchPredicate={() => true}
      mobileBottomNav
      mobileHint="Tocá un período y luego Jornadas"
      backHref="/dashboard"
      // En mobile el botón "Buscar" se reemplaza por "Jornadas": abre el
      // detalle del período seleccionado (el mismo destino al que se llega
      // desde Ingresos → Detalle tocando una fila) para cargar sus
      // jornadas/tareas. NO se propaga `origen=dashboard`: el detalle usa ese
      // parámetro para volver al dashboard, y acá tiene que volver a ESTE
      // listado (sin `origen`, el detalle vuelve a /cruds/periodos-trabajo).
      mobilePrimaryAction={{
        label: "Jornadas",
        icon: CalendarClock,
        onClick: (id) => router.push(`/cruds/periodos-trabajo/${id}`),
      }}
    />
  );
}
