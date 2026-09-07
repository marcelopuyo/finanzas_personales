"use client";
import { CrudTable } from "@/components/crud/CrudTable";
import type { TrabajoOut } from "@/backend/src/queries/trabajos";
import { eliminarTrabajo } from "@/backend/src/actions/trabajos";
import type { ColumnDef } from "@tanstack/react-table";
import { dateTimeToString, numberToCurrency } from "@/lib/utils";
import { MODALIDAD_LABEL } from "./trabajo-form-config";
const columns: ColumnDef<TrabajoOut>[] = [
  { accessorKey: "nombre", header: "Nombre" },
  { accessorKey: "fechaInicio", header: "Inicio", cell: ({ getValue }) => dateTimeToString(getValue<Date>()), meta: { align: "center" as const } },
  {
    accessorKey: "modalidadCobro",
    header: "Modalidad",
    cell: ({ getValue }) =>
      MODALIDAD_LABEL[getValue<string>() ?? "horas_variables"] ??
      getValue<string>() ??
      "",
  },
  { accessorKey: "precioHora", header: "Precio Hora", meta: { align: "right" as const, isCurrency: true }, cell: ({ getValue }) => numberToCurrency(getValue<number>() ?? 0) },
];
interface Props {
  initialData: TrabajoOut[];
  /** Origen de navegación (?origen=...). Si es "dashboard" se propaga al
      Nuevo/Editar (mantiene el contexto al volver). La flecha volver al
      dashboard es SIEMPRE visible, igual que en Personas. */
  origen?: string;
}
export function TrabajosListClient({ initialData, origen }: Props) {
  // Flecha "volver al dashboard" SIEMPRE visible junto al título (patrón mobile
  // app, igual que Personas). Cuando se viene del panel Trabajo
  // (?origen=dashboard) se propaga el origen al "+" (wizard) y al editar.
  const desdeDashboard = origen === "dashboard";
  const origenQ = desdeDashboard ? "?origen=dashboard" : "";
  return <CrudTable<TrabajoOut> title="Trabajos" columns={columns} initialData={initialData} deleteItem={eliminarTrabajo} searchPlaceholder="Buscar trabajo..." createHref={`/cruds/trabajos/nuevo${origenQ}`} editHref={(id) => `/cruds/trabajos/${id}/editar${origenQ}`} getId={(i) => i.id} searchPredicate={(i, q) => i.nombre.toLowerCase().includes(q)} mobileBottomNav backHref="/dashboard" />;
}
