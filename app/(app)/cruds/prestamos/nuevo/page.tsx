"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { crearPrestamo } from "@/backend/src/actions/prestamos";
import { prestamoSchema, prestamoFields } from "../prestamo-form-config";

function NuevoPrestamoForm() {
  // Permite precargar la cuenta desde el menú de las tarjetas del dashboard
  // (el formulario espera el NOMBRE de la cuenta, igual que sus opciones).
  const searchParams = useSearchParams();
  const cuenta = searchParams.get("cuenta") ?? "";
  return (
    <CrudForm
      title="Nuevo Préstamo"
      fields={prestamoFields}
      schema={prestamoSchema}
      defaultValues={{ cuenta }}
      onSubmit={async (d) => {
        await crearPrestamo({ detalle: (d.detalle as string) || undefined, fecha: d.fecha as string, monto: Number(d.monto), cuotas: Number(d.cuotas), sentido: d.sentido as "otorgado" | "obtenido", personaOrigen: d.personaOrigen as string, personaDestino: d.personaDestino as string, cuenta: d.cuenta as string });
      }}
      cancelHref="/cruds/prestamos"
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
