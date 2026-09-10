"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { CrudTable } from "@/components/crud/CrudTable";
import {
  eliminarJornadaTrabajo,
  eliminarTareaTrabajo,
} from "@/backend/src/actions/trabajos";
import type {
  JornadaTrabajoOut,
  PeriodoTrabajoOut,
  TareaTrabajoOut,
} from "@/backend/src/queries/trabajos";
import {
  dateTimeToString,
  decimalToTime,
  numberToCurrency,
  todayLocalISODate,
} from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");

/** Fecha calendario (UTC, como vienen los `date` del server) en formato ISO. */
function toDateKey(v: string | Date | null | undefined): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

/** Instante (fecha/hora efectiva de una tarea) a "dd/mm/aaaa hh:mm" LOCAL. */
function fechaHoraLocal(d: Date | string): string {
  const v = new Date(d);
  if (Number.isNaN(v.getTime())) return String(d);
  return `${pad(v.getDate())}/${pad(v.getMonth() + 1)}/${v.getFullYear()} ${pad(
    v.getHours()
  )}:${pad(v.getMinutes())}`;
}

/** Resumen del período que va arriba de la grilla. */
function ResumenPeriodo({
  periodo,
  currency,
  cobrable,
}: {
  periodo: PeriodoTrabajoOut;
  currency: string;
  cobrable: boolean;
}) {
  const router = useRouter();
  const trabajo = periodo.trabajo;
  const modalidad = trabajo?.modalidadCobro ?? "horas_variables";
  const esTareas = modalidad === "por_tarea";
  const etiquetaItems = esTareas ? "Tareas" : "Jornadas";
  const items = esTareas ? (periodo.tareas ?? []) : (periodo.jornadas ?? []);
  const desde = dateTimeToString(periodo.fechaDesde);
  const hasta = dateTimeToString(periodo.fechaHasta);
  const fechaEst = periodo.fechaEstimadaCobro
    ? dateTimeToString(periodo.fechaEstimadaCobro)
    : null;
  // Cobrado (histórico) vs pendiente: define el chip de estado y el título del
  // recuadro del monto.
  const fcCobro = periodo.fechaDeCobro
    ? new Date(periodo.fechaDeCobro)
    : null;
  const cobrado = !!fcCobro && fcCobro.getFullYear() >= 1901;
  const fechaCobro = fcCobro && cobrado ? dateTimeToString(fcCobro) : null;

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-header">
            {trabajo?.nombre ?? "—"}
          </p>
          <p className="text-[12px] text-subtitle">
            Desde {desde} al {hasta}
          </p>
        </div>
        {cobrable && (
          <button
            type="button"
            onClick={() =>
              router.push(`/movimientos/nuevo/cobro?periodo=${periodo.id}`)
            }
            title="Cobrar período"
            aria-label={`Cobrar período de ${trabajo?.nombre ?? "trabajo"} (${desde} al ${hasta})`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Banknote className="h-3.5 w-3.5" />
            Cobrar
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-[13px]">
        {cobrado ? (
          <span className="text-subtitle">
            Cobrado:{" "}
            <span className="font-medium text-success">{fechaCobro}</span>
          </span>
        ) : (
          <span className="text-subtitle">
            Estado:{" "}
            <span className="font-medium text-card-foreground">Pendiente</span>
          </span>
        )}
        <span className="text-subtitle">
          {etiquetaItems}:{" "}
          <span className="font-medium text-card-foreground">{items.length}</span>
        </span>
        <span className="text-subtitle">
          Fecha est. cobro:{" "}
          <span className="font-medium text-card-foreground">
            {fechaEst ?? "—"}
          </span>
        </span>
      </div>

      {/* Recuadro oscuro con el total (a cobrar o cobrado). */}
      <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
        <p className="text-[13px] font-medium text-header">
          {cobrado ? "Total cobrado" : "Total a cobrar"}
        </p>
        <p className="text-[16px] font-semibold tracking-tight text-value">
          {numberToCurrency(Number(periodo.montoACobrar ?? 0), currency)}
        </p>
      </div>
    </div>
  );
}

interface Props {
  periodo: PeriodoTrabajoOut;
  /** ISO 4217 de la moneda predeterminada del usuario. */
  currency?: string;
  /** Origen de navegación (?origen=...). "dashboard" al venir del popup. */
  origen?: string;
  /** Popup del dashboard que cargó la pantalla (?periodos=cobrar|actuales). Se
      propaga en la vuelta para reabrir ese mismo listado. */
  periodos?: string;
}

export function PeriodoTrabajoDetalleClient({
  periodo,
  currency = "USD",
  origen,
  periodos,
}: Props) {
  const modalidad = periodo.trabajo?.modalidadCobro ?? "horas_variables";
  const esHoras = modalidad === "horas_variables";
  const esTareas = modalidad === "por_tarea";

  // Cobrado = histórico: la pantalla se muestra SOLO LECTURA (sin agregar,
  // editar ni eliminar jornadas/tareas, y sin botón Cobrar).
  const fc = periodo.fechaDeCobro ? new Date(periodo.fechaDeCobro) : null;
  const cobrado = !!fc && fc.getFullYear() >= 1901;
  const editable = !cobrado;
  // Solo se puede cobrar un período cerrado (fechaHasta < hoy) y no cobrado.
  const cobrable =
    !cobrado && toDateKey(periodo.fechaHasta) < todayLocalISODate();

  // Vuelta: al dashboard se vuelve con el popup que cargó la pantalla reabierto
  // (?periodos=...). Si se entró sin popup (URL directa), se va al listado de
  // períodos.
  const desdeDashboard = origen === "dashboard";
  const qPeriodos =
    desdeDashboard && periodos ? `&periodos=${periodos}` : "";
  const selfUrl = `/cruds/periodos-trabajo/${periodo.id}${
    desdeDashboard ? `?origen=dashboard${qPeriodos}` : ""
  }`;
  const backHref = desdeDashboard
    ? `/dashboard${periodos ? `?periodos=${periodos}` : ""}`
    : "/cruds/periodos-trabajo";

  const summary = (
    <ResumenPeriodo periodo={periodo} currency={currency} cobrable={cobrable} />
  );

  // Jornadas/tareas del período (order cronológico para mostrarlas).
  const jornadas = useMemo(
    () =>
      (periodo.jornadas ?? [])
        .slice()
        .sort(
          (a, b) =>
            new Date(a.fechaJornada).getTime() -
            new Date(b.fechaJornada).getTime()
        ),
    [periodo]
  );
  const tareas = useMemo(
    () =>
      (periodo.tareas ?? [])
        .slice()
        .sort(
          (a, b) =>
            new Date(a.fechaHoraTarea).getTime() -
            new Date(b.fechaHoraTarea).getTime()
        ),
    [periodo]
  );

  const jornadaColumns = useMemo<ColumnDef<JornadaTrabajoOut>[]>(
    () => [
      {
        // Fecha + rango horario en una sola columna (la grilla entra mejor en
        // mobile). El `accessorFn` deja el texto compuesto para la exportación.
        id: "fechaHora",
        header: "Fecha/Hora",
        meta: { align: "center" as const },
        accessorFn: (j) =>
          `${dateTimeToString(j.fechaJornada)} ${decimalToTime(
            j.horaDesde
          )} - ${decimalToTime(j.horaHasta)}`,
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {dateTimeToString(row.original.fechaJornada)}{" "}
            <span className="text-subtitle">
              {decimalToTime(row.original.horaDesde)} -{" "}
              {decimalToTime(row.original.horaHasta)}
            </span>
          </span>
        ),
      },
      {
        accessorKey: "montoJornada",
        header: "Monto",
        meta: { align: "right" as const, isCurrency: true },
        cell: ({ getValue }) =>
          numberToCurrency(getValue<number>() ?? 0, currency),
      },
      {
        accessorKey: "montoPropina",
        header: "Propina",
        meta: { align: "right" as const, isCurrency: true },
        cell: ({ getValue }) =>
          numberToCurrency(getValue<number>() ?? 0, currency),
      },
    ],
    [currency]
  );

  const tareaColumns = useMemo<ColumnDef<TareaTrabajoOut>[]>(
    () => [
      {
        accessorKey: "fechaHoraTarea",
        header: "Fecha/Hora",
        cell: ({ getValue }) => fechaHoraLocal(getValue<Date>()),
      },
      {
        accessorKey: "descripcion",
        header: "Descripción",
        cell: ({ getValue }) => (
          <span className={getValue<string>() ? "" : "text-subtitle"}>
            {getValue<string>() ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "horasTarea",
        header: "Horas",
        meta: { align: "center" as const },
        cell: ({ getValue }) => (
          <span className={getValue<number | null>() != null ? "" : "text-subtitle"}>
            {getValue<number | null>() ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "montoTarea",
        header: "Monto",
        meta: { align: "right" as const, isCurrency: true },
        cell: ({ getValue }) =>
          numberToCurrency(getValue<number>() ?? 0, currency),
      },
    ],
    [currency]
  );

  if (esHoras) {
    return (
      <CrudTable<JornadaTrabajoOut, string>
        title="Jornadas del período"
        columns={jornadaColumns}
        initialData={jornadas}
        currency={currency}
        deleteItem={eliminarJornadaTrabajo}
        createHref={`/movimientos/nuevo/jornada?periodo=${periodo.id}&volverA=${encodeURIComponent(selfUrl)}`}
        editHref={(id) =>
          `/cruds/jornadas-trabajo/${id}/editar?periodoFijo=1&volverA=${encodeURIComponent(selfUrl)}`
        }
        getId={(i) => i.id}
        searchPredicate={(i, q) =>
          dateTimeToString(i.fechaJornada).includes(q) ||
          decimalToTime(i.horaDesde).includes(q)
        }
        mobileBottomNav={editable}
        showActions={editable}
        backHref={backHref}
        topContent={summary}
        emptyMessage="No hay jornadas en este período todavía."
        mobileHint="Tocá una jornada para seleccionarla"
      />
    );
  }

  if (esTareas) {
    return (
      <CrudTable<TareaTrabajoOut, string>
        title="Tareas del período"
        columns={tareaColumns}
        initialData={tareas}
        currency={currency}
        deleteItem={eliminarTareaTrabajo}
        createHref={`/movimientos/nuevo/tarea?periodo=${periodo.id}&volverA=${encodeURIComponent(selfUrl)}`}
        editHref={(id) =>
          `/cruds/tareas-trabajo/${id}/editar?periodoFijo=1&volverA=${encodeURIComponent(selfUrl)}`
        }
        getId={(i) => i.id}
        searchPredicate={(i, q) => {
          const texto = `${i.descripcion ?? ""} ${fechaHoraLocal(i.fechaHoraTarea)}`.toLowerCase();
          return texto.includes(q);
        }}
        mobileBottomNav={editable}
        showActions={editable}
        backHref={backHref}
        topContent={summary}
        emptyMessage="No hay tareas en este período todavía."
        mobileHint="Tocá una tarea para seleccionarla"
      />
    );
  }

  // fijo / horas_fijas: el período no carga jornadas ni tareas → solo lectura
  // (resumen + estado). Si está cerrado y no cobrado, el Cobrar está en el resumen.
  return (
    <CrudTable<JornadaTrabajoOut, string>
      title="Período de trabajo"
      columns={[]}
      initialData={[]}
      currency={currency}
      deleteItem={eliminarJornadaTrabajo}
      createHref={`/movimientos/nuevo/jornada?periodo=${periodo.id}`}
      editHref={(id) => `/cruds/jornadas-trabajo/${id}/editar?periodoFijo=1&volverA=${encodeURIComponent(selfUrl)}`}
      getId={(i) => i.id}
      searchPredicate={() => false}
      mobileBottomNav={false}
      showActions={false}
      backHref={backHref}
      topContent={summary}
      emptyMessage="Este período tiene modalidad fija: no carga jornadas ni tareas."
    />
  );
}
