"use client";
import { CrudTable } from "@/components/crud/CrudTable";
import type { TareaTrabajoOut } from "@/backend/src/queries/trabajos";
import { eliminarTareaTrabajo } from "@/backend/src/actions/trabajos";
import type { ColumnDef } from "@tanstack/react-table";
import { dateTimeToString, numberToCurrency } from "@/lib/utils";

type TareaRow = TareaTrabajoOut & {
  periodoTrabajo: {
    id: number;
    trabajo: string;
    modalidadCobro: string;
    fechaDesde: Date;
    fechaHasta: Date;
  } | null;
  trabajo: string;
  montoACobrarPeriodo: number | null;
};

const pad = (n: number) => String(n).padStart(2, "0");
/** Formatea un instante en fecha/hora LOCAL (dd/mm/aaaa hh:mm). */
function fechaHoraLocal(d: Date | string): string {
  const v = new Date(d);
  if (Number.isNaN(v.getTime())) return String(d);
  return `${pad(v.getDate())}/${pad(v.getMonth() + 1)}/${v.getFullYear()} ${pad(
    v.getHours()
  )}:${pad(v.getMinutes())}`;
}

const columns: ColumnDef<TareaRow>[] = [
  {
    accessorKey: "fechaHoraTarea",
    header: "Fecha/Hora",
    cell: ({ getValue }) => fechaHoraLocal(getValue<Date>()),
  },
  { accessorKey: "descripcion", header: "Descripción" },
  { accessorKey: "trabajo", header: "Trabajo" },
  {
    accessorFn: (r) => r.periodoTrabajo?.id ?? "",
    id: "periodo",
    header: "Período",
    cell: ({ row }) =>
      row.original.periodoTrabajo
        ? `${dateTimeToString(
            row.original.periodoTrabajo.fechaDesde
          )} al ${dateTimeToString(row.original.periodoTrabajo.fechaHasta)}`
        : "",
  },
  {
    accessorKey: "montoTarea",
    header: "Monto",
    meta: { align: "right" as const, isCurrency: true },
    cell: ({ getValue }) => numberToCurrency(getValue<number>() ?? 0),
  },
];

interface Props {
  initialData: TareaRow[];
}
export function TareasTrabajoListClient({ initialData }: Props) {
  return (
    <CrudTable<TareaRow, string>
      title="Tareas de Trabajo"
      columns={columns}
      initialData={initialData}
      deleteItem={eliminarTareaTrabajo}
      createHref="/cruds/tareas-trabajo/nuevo"
      editHref={(id) => `/cruds/tareas-trabajo/${id}/editar`}
      getId={(i) => i.id}
      searchPredicate={(i, q) =>
        (i.descripcion ?? "").toLowerCase().includes(q) ||
        i.trabajo.toLowerCase().includes(q)
      }
    />
  );
}
