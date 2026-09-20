"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Banknote } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { CrudTable } from "@/components/crud/CrudTable";
import { LinkNavStatus, usePendingNav } from "@/components/ui/nav-progress";
import {
  eliminarJornadaTrabajo,
  eliminarTareaTrabajo,
} from "@/backend/src/actions/trabajos";
import { cobroAdelantado, periodoCobrable } from "@/backend/src/lib/jornadas";
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

/** Horas decimales de una jornada. Convierte el formato HH.MM del backend
    (ej. 17.3 = 17:30) a horas decimales con la MISMA fórmula que
    `calcularMontoJornada` (backend/src/lib/jornadas.ts). */
function horasDeJornada(j: JornadaTrabajoOut): number {
  const aDecimal = (v: number) => ((v - Math.trunc(v)) * 100) / 60 + Math.trunc(v);
  return Math.max(0, aDecimal(j.horaHasta) - aDecimal(j.horaDesde));
}

/** Horas decimales a "H:MM" (ej. 8.5 → "8:30"). */
function horasATexto(horas: number): string {
  const totalMinutos = Math.round(horas * 60);
  return `${Math.floor(totalMinutos / 60)}:${String(totalMinutos % 60).padStart(
    2,
    "0"
  )}`;
}

/**
 * TARJETA de una jornada en la grilla mobile del detalle del período
 * (2026-09-19, mismo patrón que trabajos/cuentas/préstamos/categorías).
 *
 * **fecha** arriba a la izquierda y el **monto de la jornada** a la derecha como
 * protagonista; debajo, en gris chico, el **rango horario + duración**
 * (`17:00 - 21:00 · 4 h`) y, si la hay, la **propina**. El rango y las horas
 * salen de `decimalToTime`/`horasDeJornada` (las MISMAS funciones que usa el
 * resumen de arriba y la cabecera del PDF), así que la tarjeta no puede
 * desincronizarse de los totales.
 */
function JornadaCard({
  j,
  currency,
}: {
  j: JornadaTrabajoOut;
  currency: string;
}) {
  const propina = j.montoPropina || 0;
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[14px] font-semibold text-header">
          {dateTimeToString(j.fechaJornada)}
        </span>
        <span className="shrink-0 text-[14px] font-semibold text-value">
          {numberToCurrency(j.montoJornada ?? 0, currency)}
        </span>
      </div>
      <div className="mt-0.5 flex items-baseline justify-between gap-2 text-[11.5px] text-subtitle">
        <span className="truncate">
          {decimalToTime(j.horaDesde)} - {decimalToTime(j.horaHasta)}
          {` · ${horasATexto(horasDeJornada(j))} h`}
        </span>
        {propina > 0 && (
          <span className="shrink-0">
            Propina {numberToCurrency(propina, currency)}
          </span>
        )}
      </div>
    </>
  );
}

/**
 * TARJETA de una tarea en la grilla mobile del detalle del período (2026-09-19,
 * espejo de `JornadaCard`: el usuario pidió que "Tareas del período" quede igual
 * que "Jornadas del período").
 *
 * **fecha/hora** arriba a la izquierda y el **monto de la tarea** a la derecha
 * como protagonista; debajo, en gris chico, la **descripción** y —si está
 * cargada— las **horas** de la tarea. La fecha/hora se muestra en formato LOCAL
 * (`fechaHoraLocal`), igual que la grilla de escritorio, para no mostrar la
 * conversión a UTC.
 */
function TareaCard({
  t,
  currency,
}: {
  t: TareaTrabajoOut;
  currency: string;
}) {
  const horas = t.horasTarea;
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[14px] font-semibold text-header">
          {fechaHoraLocal(t.fechaHoraTarea)}
        </span>
        <span className="shrink-0 text-[14px] font-semibold text-value">
          {numberToCurrency(t.montoTarea ?? 0, currency)}
        </span>
      </div>
      <div className="mt-0.5 flex items-baseline justify-between gap-2 text-[11.5px] text-subtitle">
        <span className="truncate">{t.descripcion ?? "—"}</span>
        {horas != null && <span className="shrink-0">{horas} h</span>}
      </div>
    </>
  );
}

/** Datos derivados del período. Los usan el resumen en pantalla y la cabecera
    del PDF, para no duplicar los cálculos ni poder desincronizarse. */
function datosPeriodo(periodo: PeriodoTrabajoOut) {
  const trabajo = periodo.trabajo;
  const modalidad = trabajo?.modalidadCobro ?? "horas_variables";
  const esTareas = modalidad === "por_tarea";
  const esHoras = modalidad === "horas_variables";
  const etiquetaItems = esTareas ? "Tareas" : "Jornadas";
  const items = esTareas ? (periodo.tareas ?? []) : (periodo.jornadas ?? []);
  const desde = dateTimeToString(periodo.fechaDesde);
  const hasta = dateTimeToString(periodo.fechaHasta);
  const fechaEst = periodo.fechaEstimadaCobro
    ? dateTimeToString(periodo.fechaEstimadaCobro)
    : null;
  // Cobrado (histórico) vs pendiente: define el estado y el título del recuadro
  // del monto.
  const fcCobro = periodo.fechaDeCobro
    ? new Date(periodo.fechaDeCobro)
    : null;
  const cobrado = !!fcCobro && fcCobro.getFullYear() >= 1901;
  const fechaCobro = fcCobro && cobrado ? dateTimeToString(fcCobro) : null;
  // Totales de las jornadas cargadas: horas trabajadas (HH.MM → decimales),
  // monto de esas horas y propina. Aplican sólo a la modalidad `horas_variables`
  // (fijo/horas_fijas no cargan jornadas y `por_tarea` usa tareas), así que se
  // ocultan en las otras modalidades para no mostrar ceros engañosos.
  const jornadas = periodo.jornadas ?? [];
  const totalHoras = jornadas.reduce((suma, j) => suma + horasDeJornada(j), 0);
  const montoHoras = jornadas.reduce((suma, j) => suma + (j.montoJornada || 0), 0);
  const montoPropina = jornadas.reduce(
    (suma, j) => suma + (j.montoPropina || 0),
    0
  );
  return {
    trabajo,
    esHoras,
    etiquetaItems,
    items,
    desde,
    hasta,
    fechaEst,
    cobrado,
    fechaCobro,
    totalHoras,
    montoHoras,
    montoPropina,
    // Cobro ADELANTADO: cobrado antes de la fecha de cierre del período.
    adelantado: cobroAdelantado(periodo),
    total: Number(periodo.montoACobrar ?? 0),
  };
}

/** Cabecera del PDF: los datos del período que se exportan arriba de la grilla
    de jornadas/tareas (mismos valores que el resumen en pantalla). */
function cabeceraPeriodo(
  periodo: PeriodoTrabajoOut,
  currency: string
): { label: string; value: string }[] {
  const d = datosPeriodo(periodo);
  const filas: { label: string; value: string }[] = [
    { label: "Trabajo", value: d.trabajo?.nombre ?? "—" },
    { label: "Período", value: `Desde ${d.desde} al ${d.hasta}` },
    {
      label: "Estado",
      value: d.cobrado
        ? `Cobrado${d.adelantado ? " (adelantado)" : ""} el ${d.fechaCobro}`
        : "Pendiente",
    },
    { label: d.etiquetaItems, value: String(d.items.length) },
  ];
  if (d.esHoras) {
    filas.push(
      { label: "Horas", value: horasATexto(d.totalHoras) },
      {
        label: "Monto de horas",
        value: numberToCurrency(d.montoHoras, currency),
      },
      {
        label: "Monto de propina",
        value: numberToCurrency(d.montoPropina, currency),
      }
    );
  }
  if (!d.cobrado) {
    filas.push({ label: "Fecha est. cobro", value: d.fechaEst ?? "—" });
  }
  filas.push({
    label: d.cobrado ? "Total cobrado" : "Total a cobrar",
    value: numberToCurrency(d.total, currency),
  });
  return filas;
}

/** Resumen del período que va arriba de la grilla. */
function ResumenPeriodo({
  periodo,
  currency,
  cobrable,
  enCurso,
}: {
  periodo: PeriodoTrabajoOut;
  currency: string;
  /** Se puede cobrar (ya empezó y no está cobrado). */
  cobrable: boolean;
  /** El período está vigente hoy (empezó y todavía no cerró). */
  enCurso: boolean;
}) {
  const {
    trabajo,
    etiquetaItems,
    items,
    desde,
    hasta,
    fechaEst,
    cobrado,
    fechaCobro,
    esHoras,
    totalHoras,
    montoHoras,
    montoPropina,
    adelantado,
  } = datosPeriodo(periodo);

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
          // `<Link>` (2026-09-17): Next prefetchea el wizard de cobro apenas el
          // botón entra en pantalla.
          <Link
            href={`/movimientos/nuevo/cobro?periodo=${periodo.id}`}
            title="Cobrar período"
            aria-label={`Cobrar período de ${trabajo?.nombre ?? "trabajo"} (${desde} al ${hasta})`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Banknote className="h-3.5 w-3.5" />
            Cobrar
            <LinkNavStatus />
          </Link>
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
        {esHoras && (
          <>
            <span className="text-subtitle">
              Horas:{" "}
              <span className="font-medium text-card-foreground">
                {horasATexto(totalHoras)}
              </span>
            </span>
            <span className="text-subtitle">
              Monto de horas:{" "}
              <span className="font-medium text-card-foreground">
                {numberToCurrency(montoHoras, currency)}
              </span>
            </span>
            <span className="text-subtitle">
              Monto de propina:{" "}
              <span className="font-medium text-card-foreground">
                {numberToCurrency(montoPropina, currency)}
              </span>
            </span>
          </>
        )}
        {/* La fecha estimada de cobro ya no aporta nada en un período cobrado. */}
        {!cobrado && (
          <span className="text-subtitle">
            Fecha est. cobro:{" "}
            <span className="font-medium text-card-foreground">
              {fechaEst ?? "—"}
            </span>
          </span>
        )}
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

      {/* COBRO ADELANTADO (fijo/horas_fijas en curso): se avisa que el cobro se
          hace por adelantado y que NO se tocan las fechas del período. */}
      {cobrable && enCurso && (
        <p className="mt-2 text-[12px] text-subtitle">
          Período <span className="font-medium text-header">en curso</span>{" "}
          (cierra el {hasta}): el cobro es{" "}
          <span className="font-medium text-header">por adelantado</span> y no
          modifica las fechas del período.
        </p>
      )}
      {cobrado && adelantado && fechaCobro && (
        <p className="mt-2 text-[12px] text-subtitle">
          Cobrado{" "}
          <span className="font-medium text-success">por adelantado</span> el{" "}
          {fechaCobro}.
        </p>
      )}
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
  // Navegación con feedback (barra de progreso global) para el toque de tarjeta.
  const { go: nav } = usePendingNav();
  // COBRO ADELANTADO (decisión del usuario 2026-09-14): se puede cobrar apenas
  // el período EMPEZÓ (no hace falta esperar al cierre) — pensado para los
  // trabajos `fijo` / `horas_fijas`, que no cargan jornadas ni tareas. El
  // `fechaDeCobro` que deja el cobro es el candado: un período cobrado no se
  // vuelve a cobrar nunca (y las fechas del período NO se tocan).
  const hoyKey = todayLocalISODate();
  const cobrable = periodoCobrable(periodo, hoyKey);
  // Vigente hoy (empezó y no cerró): se usa para avisar que el cobro es
  // "por adelantado".
  const enCurso =
    toDateKey(periodo.fechaDesde) <= hoyKey &&
    toDateKey(periodo.fechaHasta) >= hoyKey;

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

  // Destino de la edición de una jornada: lo comparten la tabla de escritorio, el
  // menú deslizante del mobile y el toque de la tarjeta (mantiene el
  // `periodoFijo=1` y el `volverA` a este detalle).
  const jornadaEditHref = (id: string) =>
    `/cruds/jornadas-trabajo/${id}/editar?periodoFijo=1&volverA=${encodeURIComponent(
      selfUrl
    )}`;
  // Ídem para las tareas (misma idea: la usan la tabla, el swipe y el toque).
  const tareaEditHref = (id: string) =>
    `/cruds/tareas-trabajo/${id}/editar?periodoFijo=1&volverA=${encodeURIComponent(
      selfUrl
    )}`;

  const summary = (
    <ResumenPeriodo
      periodo={periodo}
      currency={currency}
      cobrable={cobrable}
      enCurso={enCurso}
    />
  );

  // Cabecera que el PDF exporta arriba de la grilla (los datos del período).
  const exportInfo = useMemo(
    () => cabeceraPeriodo(periodo, currency),
    [periodo, currency]
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

  // El modo mobile va SIEMPRE encendido, incluso en solo lectura: si se apaga
  // (mobileBottomNav={editable}), la pantalla cae en la vista clásica y en
  // mobile aparece el buscador de escritorio entre el resumen y la grilla.
  // `showActions={editable}` es lo que oculta las acciones.
  if (esHoras) {
    return (
      <CrudTable<JornadaTrabajoOut, string>
        title="Jornadas del período"
        columns={jornadaColumns}
        initialData={jornadas}
        currency={currency}
        deleteItem={eliminarJornadaTrabajo}
        createHref={`/movimientos/nuevo/jornada?periodo=${periodo.id}&volverA=${encodeURIComponent(selfUrl)}`}
        editHref={jornadaEditHref}
        getId={(i) => i.id}
        searchPredicate={(i, q) =>
          dateTimeToString(i.fechaJornada).includes(q) ||
          decimalToTime(i.horaDesde).includes(q)
        }
        mobileBottomNav
        showActions={editable}
        showSearch={editable}
        backHref={backHref}
        topContent={summary}
        exportInfo={exportInfo}
        emptyMessage="No hay jornadas en este período todavía."
        // Mobile (§131): cada jornada es una TARJETA; el toque abre la edición y
        // el swipe revela Editar/Eliminar (los aporta `CrudTable`). En SOLO
        // LECTURA (período ya cobrado) no se pasa `mobileSwipe`: las tarjetas se
        // muestran sin ninguna acción. Con swipe la fila no se selecciona, así
        // que se quitó el `mobileHint` ("Tocá una jornada para seleccionarla").
        mobileRow={(j) => <JornadaCard j={j} currency={currency} />}
        mobileSwipe={
          editable
            ? { onRowTap: (id) => nav(jornadaEditHref(id), "row") }
            : undefined
        }
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
        editHref={tareaEditHref}
        getId={(i) => i.id}
        searchPredicate={(i, q) => {
          const texto = `${i.descripcion ?? ""} ${fechaHoraLocal(i.fechaHoraTarea)}`.toLowerCase();
          return texto.includes(q);
        }}
        mobileBottomNav
        showActions={editable}
        showSearch={editable}
        backHref={backHref}
        topContent={summary}
        exportInfo={exportInfo}
        emptyMessage="No hay tareas en este período todavía."
        // Mobile (§132): espejo de las jornadas → cada tarea es una TARJETA, el
        // toque abre la edición y el swipe revela Editar/Eliminar. En SOLO
        // LECTURA (período cobrado) no se pasa `mobileSwipe`, así que las
        // tarjetas quedan sin ninguna acción; tampoco hace falta el `mobileHint`.
        mobileRow={(t) => <TareaCard t={t} currency={currency} />}
        mobileSwipe={
          editable
            ? { onRowTap: (id) => nav(tareaEditHref(id), "row") }
            : undefined
        }
      />
    );
  }

  // fijo / horas_fijas: el período no carga jornadas ni tareas → solo lectura
  // (resumen + estado). Si está cerrado y no cobrado, el Cobrar está en el resumen.
  // Igual que arriba: mobileBottomNav se mantiene para no caer en la vista de
  // escritorio (con buscador) en mobile.
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
      mobileBottomNav
      showActions={false}
      showSearch={false}
      backHref={backHref}
      topContent={summary}
      emptyMessage="Este período tiene modalidad fija: no carga jornadas ni tareas."
    />
  );
}
