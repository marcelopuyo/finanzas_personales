"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CalendarPlus, ListPlus } from "lucide-react";
import { CrudTable } from "@/components/crud/CrudTable";
import type { PeriodoTrabajoOut } from "@/backend/src/queries/trabajos";
import { eliminarPeriodoTrabajo } from "@/backend/src/actions/trabajos";
import { periodoCobrado } from "@/backend/src/lib/jornadas";
import { ActividadCell } from "@/app/(app)/dashboard/components/ingresos-detalle";
import type { ColumnDef } from "@tanstack/react-table";
import { dateTimeToString, numberToCurrency, todayLocalISODate } from "@/lib/utils";

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

/** Fecha en formato "dd-mm-aa" (año con los DOS últimos dígitos, ej. 06-09-26).
    Se usa solo en la grilla mobile, para que la columna de fechas quede angosta. */
function fechaCortaDMY(v: Date | string): string {
  const [y, m, d] = toDateKey(v).split("-");
  return `${d}-${m}-${y.slice(-2)}`;
}

// Columnas de la grilla MOBILE (decisión 2026-09-13): sólo 3 — Trabajo,
// Período (Desde + Hasta fusionadas) y Monto — para que la tabla entre en el
// ancho del celular. Con las 6 columnas de desktop la tabla desbordaba la
// tarjeta (~234px a 390px de viewport) y obligaba a scroll horizontal.
function periodoTrabajoMobileColumns(
  currency: string
): ColumnDef<PeriodoTrabajoOut>[] {
  return [
    {
      accessorFn: (r) => r.trabajo?.nombre ?? "",
      id: "trabajo",
      header: "Trabajo",
      // Sin `truncate`: `truncate` implica `white-space: nowrap`, que fija el
      // min-content de la celda al ancho COMPLETO del texto y le impide a la
      // tabla achicar esa columna (era justo lo que hacía desbordar el ancho del
      // celular). Con el texto normal, un nombre largo baja a 2 líneas y la
      // columna cede espacio a las fechas y al monto.
      cell: ({ row }) => row.original.trabajo?.nombre ?? "—",
    },
    {
      // Desde + Hasta fusionadas: una fecha por línea, sin la palabra "al" y
      // con el año en 2 dígitos ("06-09-26"), para que la columna quede angosta.
      // El accessor expone `fechaDesde` para que el orden (por defecto y al
      // tocar el header) sea CRONOLÓGICO por inicio.
      id: "periodo",
      header: "Período",
      accessorFn: (r) => r.fechaDesde,
      sortingFn: (a, b) =>
        new Date(a.original.fechaDesde).getTime() -
        new Date(b.original.fechaDesde).getTime(),
      cell: ({ row }) => (
        <span className="block leading-4 whitespace-nowrap">
          <span className="block">
            {fechaCortaDMY(row.original.fechaDesde)}
          </span>
          <span className="block">
            {fechaCortaDMY(row.original.fechaHasta)}
          </span>
        </span>
      ),
      meta: {
        exportValue: (row: PeriodoTrabajoOut) =>
          `${dateTimeToString(row.fechaDesde)} al ${dateTimeToString(
            row.fechaHasta
          )}`,
      },
    },
    {
      accessorKey: "montoACobrar",
      id: "monto",
      header: "Monto",
      meta: { align: "right" as const, isCurrency: true },
      cell: ({ getValue }) =>
        numberToCurrency(getValue<number>() ?? 0, currency),
    },
  ];
}

/** Total PERCIBIDO por el período: monto a cobrar + propina de sus jornadas.
    `montoACobrar` NO incluye la propina (decisión 2026-08-06: se deposita
    aparte en una cuenta), así que hay que sumarla para mostrar el total real
    (mismo criterio que los ingresos del panel "Resultados"). */
function totalConPropina(p: PeriodoTrabajoOut): number {
  const propina = (p.jornadas ?? []).reduce(
    (suma, j) => suma + (j.montoPropina || 0),
    0
  );
  return (p.montoACobrar ?? 0) + propina;
}

// Columnas de la vista "Períodos Finalizados" (decisión 2026-09-13): el nombre
// del trabajo y el rango "Desde al Hasta" van JUNTOS en una sola columna, y el
// único importe que se muestra es lo percibido (monto a cobrar + propina).
function periodoFinalizadoColumns(
  currency: string
): ColumnDef<PeriodoTrabajoOut>[] {
  return [
    {
      // Fusiona Trabajo + Desde + Hasta en una sola columna. El accessor expone
      // `fechaDesde` para que el orden por defecto y el clic en el header sean
      // CRONOLÓGICOS por fecha de inicio (no por el texto "dd-mm-aaaa al ...").
      id: "trabajoPeriodo",
      header: "Trabajo",
      accessorFn: (r) => r.fechaDesde,
      sortingFn: (a, b) =>
        new Date(a.original.fechaDesde).getTime() -
        new Date(b.original.fechaDesde).getTime(),
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-header">
            {row.original.trabajo?.nombre ?? "—"}
          </p>
          <p className="text-[11px] text-subtitle">
            Desde {dateTimeToString(row.original.fechaDesde)} al{" "}
            {dateTimeToString(row.original.fechaHasta)}
          </p>
        </div>
      ),
      meta: {
        exportValue: (row: PeriodoTrabajoOut) =>
          `${row.trabajo?.nombre ?? "—"} (${dateTimeToString(
            row.fechaDesde
          )} al ${dateTimeToString(row.fechaHasta)})`,
      },
    },
    {
      id: "total",
      header: "Monto",
      accessorFn: (r) => totalConPropina(r),
      meta: { align: "right" as const, isCurrency: true },
      cell: ({ getValue }) =>
        numberToCurrency(getValue<number>() ?? 0, currency),
    },
  ];
}

/** Clave ISO "YYYY-MM-DD" de una fecha, para comparar sin importar si llega
    como `Date` o como string (mismo criterio que el dashboard). */
function toDateKey(v: Date | string): string {
  return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
}

/** Color de FUENTE de la fila según el estado del período (decisión 2026-09-13:
    se pinta el texto, NO el fondo de la fila): verde = POR COBRAR (ya cerró y
    todavía no se cobró) · rojo = EN CURSO (vigente hoy y sin cobrar) · sin color
    = ya cobrado o todavía no comenzado.
    ⚠️ `[&>td]:text-inherit` es necesario porque `DataTable` pinta cada `<td>` con
    `text-card-foreground` (propio); sin eso el color del `<tr>` no llega a las
    celdas. */
function filaEstadoCls(p: PeriodoTrabajoOut): string {
  if (periodoCobrado(p)) return "";
  const hoy = todayLocalISODate();
  const desde = toDateKey(p.fechaDesde);
  const hasta = toDateKey(p.fechaHasta);
  if (hasta < hoy) return "text-success [&>td]:text-inherit";
  if (desde <= hoy && hasta >= hoy) return "text-danger [&>td]:text-inherit";
  return "";
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
  /** Vista "Finalizados" (llega desde la tarjeta del panel Trabajo con
      `?estado=cobrado`): lista ÚNICAMENTE los períodos ya cobrados, con columnas
      reducidas (Trabajo + rango de fechas en una sola columna y el total
      percibido: monto a cobrar + propina). */
  soloCobrados?: boolean;
}
export function PeriodosTrabajoListClient({
  initialData,
  origen,
  currency = "USD",
  soloCobrados = false,
}: Props) {
  const router = useRouter();
  // Flecha "volver al dashboard" SIEMPRE visible. Al venir del panel Trabajo
  // (?origen=dashboard) se propaga el origen para que el "+" (wizard) mantenga
  // el viaje de ida y vuelta al dashboard.
  const desdeDashboard = origen === "dashboard";
  const origenQ = desdeDashboard ? "?origen=dashboard" : "";
  // Abre el detalle del período (sus jornadas/tareas): es el destino del
  // TOQUE simple sobre una fila en mobile (modo swipe) y de la acción por fila
  // del desktop.
  const abrirDetalle = (id: number) =>
    router.push(`/cruds/periodos-trabajo/${id}`);
  /** Acción de CARGA del menú deslizante, según la MODALIDAD del trabajo
      (decisión 2026-09-13): `horas_variables` → **Nueva jornada** · `por_tarea`
      → **Nueva tarea** · `fijo`/`horas_fijas` → **ninguna** (no cargan jornadas
      ni tareas). Un período COBRADO es de solo lectura, así que tampoco ofrece
      la acción. La clave de la acción es también el slug del wizard
      (`/movimientos/nuevo/<slug>`). */
  const accionesCarga = (p: PeriodoTrabajoOut) => {
    if (periodoCobrado(p)) return [];
    const modalidad = p.trabajo?.modalidadCobro ?? "horas_variables";
    const tipo =
      modalidad === "horas_variables"
        ? { slug: "jornada", label: "Nueva jornada", icon: CalendarPlus }
        : modalidad === "por_tarea"
          ? { slug: "tarea", label: "Nueva tarea", icon: ListPlus }
          : null;
    if (!tipo) return [];
    // Mismo destino que el "+" del detalle del período: wizard directo, con el
    // período precargado y vuelta a ESTE listado (Cancelar/guardar).
    return [
      {
        key: tipo.slug,
        label: tipo.label,
        icon: tipo.icon,
        onClick: () =>
          router.push(
            `/movimientos/nuevo/${tipo.slug}?periodo=${p.id}&volverA=${encodeURIComponent(
              urlListado
            )}`
          ),
      },
    ];
  };
  // Acceso por id: el menú deslizante pide las acciones por id de fila.
  const porId = useMemo(
    () => new Map(initialData.map((p) => [p.id, p])),
    [initialData]
  );
  // URL de ESTE listado (con `origen` si vino del dashboard): es el `volverA`
  // del wizard de jornada, para que Cancelar/guardar vuelvan acá.
  const urlListado = `/cruds/periodos-trabajo${origenQ}`;
  // Vista "Finalizados": se descartan los períodos pendientes. El array va
  // MEMOIZADO porque `CrudTable` re-sincroniza su estado desde `initialData`
  // (si se recreara en cada render se produciría un loop de re-sync).
  const dataGrilla = useMemo(
    () => (soloCobrados ? initialData.filter((p) => periodoCobrado(p)) : initialData),
    [initialData, soloCobrados]
  );
  return (
    <CrudTable<PeriodoTrabajoOut>
      title={soloCobrados ? "Períodos Finalizados" : "Períodos de Trabajo"}
      columns={
        soloCobrados
          ? periodoFinalizadoColumns(currency)
          : periodoTrabajoColumns(currency)
      }
      // Grilla MOBILE reducida: 3 columnas (Trabajo · Período · Monto). La vista
      // "Finalizados" ya tiene 2 columnas, así que reutiliza las mismas.
      mobileColumns={
        soloCobrados
          ? periodoFinalizadoColumns(currency)
          : periodoTrabajoMobileColumns(currency)
      }
      initialData={dataGrilla}
      currency={currency}
      // Color de la FUENTE por estado (decisión 2026-09-13): verde = por cobrar,
      // rojo = en curso, sin color = cobrados. En la vista "Finalizados"
      // (soloCobrados) todas las filas están cobradas, así que no se pinta ninguna.
      rowClassName={filaEstadoCls}
      deleteItem={eliminarPeriodoTrabajo}
      createHref={`/cruds/periodos-trabajo/nuevo${origenQ}`}
      editHref={(id) => `/cruds/periodos-trabajo/${id}/editar${origenQ}`}
      getId={(i) => i.id}
      searchPredicate={() => true}
      mobileBottomNav
      backHref="/dashboard"
      // Modo swipe (decisión 2026-09-13): la fila NO se selecciona; un TOQUE
      // abre el detalle del período (jornadas/tareas) — el acceso que antes
      // estaba en el botón "Jornadas" de la barra inferior — y el menú
      // deslizante revela la acción de carga según la MODALIDAD del trabajo
      // (Nueva jornada / Nueva tarea, o ninguna) + las acciones fijas Editar y
      // Eliminar. NO se propaga `origen=dashboard`: el detalle usa ese parámetro
      // para volver al dashboard, y acá tiene que volver a ESTE listado (sin
      // `origen`, el detalle vuelve a /cruds/periodos-trabajo).
      mobileSwipe={{
        onRowTap: abrirDetalle,
        // Más ancha que el default (148) para que entren 3 acciones.
        width: 192,
        extraActions: (id) => {
          const p = porId.get(id);
          return p ? accionesCarga(p) : [];
        },
      }}
      // En desktop no hay swipe ni barra inferior, así que el acceso al detalle
      // va como acción por fila en la columna de acciones (ícono con tooltip).
      rowAction={{
        label: "Ver jornadas/tareas del período",
        icon: CalendarClock,
        onClick: abrirDetalle,
      }}
    />
  );
}
