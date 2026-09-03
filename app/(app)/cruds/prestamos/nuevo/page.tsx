"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { crearPrestamo } from "@/backend/src/actions/prestamos";
import { prestamoSchema, prestamoFields } from "../prestamo-form-config";

function NuevoPrestamoForm() {
  const searchParams = useSearchParams();
  // Permite precargar la cuenta desde el menú de las tarjetas del dashboard
  // (el formulario espera el NOMBRE de la cuenta, igual que sus opciones).
  const cuenta = searchParams.get("cuenta") ?? "";
  // Cuando se abre desde el panel de préstamos del dashboard (?origen=dashboard),
  // Cancelar / volver debe regresar al dashboard (el que llamó), no al listado.
  const desdeDashboard = searchParams.get("origen") === "dashboard";
  return (
    <CrudForm
      title="Nuevo Préstamo"
      fields={prestamoFields}
      schema={prestamoSchema}
      defaultValues={{ cuenta }}
      onSubmit={async (d) => {
        await crearPrestamo({ detalle: (d.detalle as string) || undefined, fecha: d.fecha as string, monto: Number(d.monto), cuotas: Number(d.cuotas), sentido: d.sentido as "otorgado" | "obtenido", personaOrigen: d.personaOrigen as string, personaDestino: d.personaDestino as string, cuenta: d.cuenta as string });
      }}
      cancelHref={desdeDashboard ? "/dashboard" : "/cruds/prestamos"}
      successHref="/cruds/prestamos"
      successMessage="Préstamo creado correctamente"
    />
  );
}

export default function NuevoPrestamoPage() {
  return (
    <Suspense fallback={null}>
      <NuevoPrestamoForm />
    </Suspense>
  );
}
