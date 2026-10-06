"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { crearPrestamo } from "@/backend/src/actions/prestamos";
import { destinoFormularioCrud } from "@/lib/origen-crud";
import { prestamoSchema, prestamoFieldsNuevo } from "../prestamo-form-config";
import { todayLocalISODate } from "@/lib/utils";

function NuevoPrestamoForm() {
  const searchParams = useSearchParams();
  // Permite precargar la cuenta desde el menú de las tarjetas del dashboard
  // (el formulario espera el NOMBRE de la cuenta, igual que sus opciones).
  const cuenta = searchParams.get("cuenta") ?? "";
  // Cuando el CRUD se abre desde el ⋯ del panel de préstamos (?origen=prestamos),
  // el "+" del listado llega con ese origen: Cancelar y guardar vuelven al listado
  // CONSERVANDO el origen (mantiene la flecha "Volver" a esa vista). Sin origen,
  // se vuelve al listado normal.
  // `volverA`: retorno EXPLÍCITO del listado embebido (p. ej. `/dashboard/prestamos`);
  // si no, el listado del CRUD conservando el `origen`.
  const destino = destinoFormularioCrud(
    "/cruds/prestamos",
    searchParams.get("origen"),
    searchParams.get("volverA")
  );
  return (
    <CrudForm
      title="Nuevo Préstamo"
      fields={prestamoFieldsNuevo}
      schema={prestamoSchema}
      // Fecha precargada con HOY (la calcula el navegador al montar el
      // formulario, por lo que es la fecha local del usuario y puede editarse).
      defaultValues={{ cuenta, fecha: todayLocalISODate() }}
      onSubmit={async (d) => {
        await crearPrestamo({ detalle: (d.detalle as string) || undefined, fecha: d.fecha as string, monto: Number(d.monto), sentido: d.sentido as "otorgado" | "obtenido", personaContraparte: d.personaContraparte as string, cuenta: d.cuenta as string });
      }}
      cancelHref={destino}
      successHref={destino}
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
