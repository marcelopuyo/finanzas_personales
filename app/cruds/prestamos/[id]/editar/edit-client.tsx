"use client";
import { useParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { actualizarPrestamo } from "@/backend/src/actions/prestamos";
import type { PrestamoOut } from "@/backend/src/queries/prestamos";
import { prestamoSchema, prestamoFields } from "../../prestamo-form-config";
const dt = (v: Date) => String(v).slice(0, 10);
interface Props { data: PrestamoOut }
export function EditarPrestamoClient({ data }: Props) {
  const p = useParams();
  return <CrudForm title="Editar Préstamo" fields={prestamoFields} schema={prestamoSchema} defaultValues={{ detalle: data.detalle ?? "", fecha: dt(data.fecha), monto: data.monto, saldo: data.saldo, cuotas: data.cuotas, sentido: data.sentido as "otorgado" | "obtenido", personaOrigen: data.personaOrigen?.nombre ?? "", personaDestino: data.personaDestino?.nombre ?? "", cuenta: data.cuenta?.nombre ?? "" }} onSubmit={async (f) => {
    await actualizarPrestamo(String(p.id), { detalle: (f.detalle as string) || undefined, fecha: f.fecha as string, monto: Number(f.monto), saldo: Number(f.saldo), cuotas: Number(f.cuotas), sentido: f.sentido as "otorgado" | "obtenido", personaOrigen: f.personaOrigen as string, personaDestino: f.personaDestino as string, cuenta: f.cuenta as string });
  }} cancelHref="/cruds/prestamos" successMessage="Préstamo actualizado correctamente" />;
}
