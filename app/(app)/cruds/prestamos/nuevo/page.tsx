"use client";
import { CrudForm } from "@/components/crud/CrudForm";
import { crearPrestamo } from "@/backend/src/actions/prestamos";
import { prestamoSchema, prestamoFields } from "../prestamo-form-config";
export default function NuevoPrestamoPage() {
  return <CrudForm title="Nuevo Préstamo" fields={prestamoFields} schema={prestamoSchema} onSubmit={async (d) => {
    await crearPrestamo({ detalle: (d.detalle as string) || undefined, fecha: d.fecha as string, monto: Number(d.monto), saldo: Number(d.saldo), cuotas: Number(d.cuotas), sentido: d.sentido as "otorgado" | "obtenido", personaOrigen: d.personaOrigen as string, personaDestino: d.personaDestino as string, cuenta: d.cuenta as string });
  }} cancelHref="/cruds/prestamos" successMessage="Préstamo creado correctamente" />;
}
