"use client";
import { useParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { actualizarPrestamo } from "@/backend/src/actions/prestamos";
import type { PrestamoOut } from "@/backend/src/queries/prestamos";
import { prestamoSchema, prestamoFields } from "../../prestamo-form-config";
const dt = (v: Date) => String(v).slice(0, 10);
interface Props {
  data: PrestamoOut;
  /** Origen de navegación (?origen=...). Si es "dashboard", Cancelar / volver
      regresan al listado conservando el origen (mantiene el botón volver). */
  origen?: string;
}
export function EditarPrestamoClient({ data, origen }: Props) {
  const p = useParams();
  const destino =
    origen === "dashboard"
      ? "/cruds/prestamos?origen=dashboard"
      : "/cruds/prestamos";
  return <CrudForm title="Editar Préstamo" fields={prestamoFields} schema={prestamoSchema} defaultValues={{ detalle: data.detalle ?? "", fecha: dt(data.fecha), monto: data.monto, sentido: data.sentido as "otorgado" | "obtenido", personaContraparte: data.personaContraparte?.nombre ?? "", cuenta: data.cuenta?.nombre ?? "" }} onSubmit={async (f) => {
    await actualizarPrestamo(String(p.id), { detalle: (f.detalle as string) || undefined, fecha: f.fecha as string, monto: Number(f.monto), sentido: f.sentido as "otorgado" | "obtenido", personaContraparte: f.personaContraparte as string, cuenta: f.cuenta as string });
  }} cancelHref={destino} successHref={destino} successMessage="Préstamo actualizado correctamente" />;
}
