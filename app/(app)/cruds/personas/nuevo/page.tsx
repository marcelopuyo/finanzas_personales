"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { crearPersona } from "@/backend/src/actions/maestros";
import { sufijoOrigen } from "@/lib/origen-crud";
import { personaSchema, personaFields } from "../persona-form-config";

function NuevaPersonaForm() {
  const searchParams = useSearchParams();
  // Abierto desde el CRUD (que a su vez viene de una vista del dashboard):
  // Cancelar / volver y el destino tras guardar vuelven al listado CONSERVANDO el
  // origen, para que siga mostrando la flecha "volver" a esa vista.
  const destino = `/cruds/personas${sufijoOrigen(searchParams.get("origen"))}`;
  return <CrudForm title="Nueva Persona" fields={personaFields} schema={personaSchema} onSubmit={async (d) => { await crearPersona({ nombre: d.nombre as string, telefono: (d.telefono as string) || undefined, mail: (d.mail as string) || undefined }); }} cancelHref={destino} successHref={destino} successMessage="Persona creada correctamente" />;
}

export default function NuevaPersonaPage() {
  return (
    <Suspense fallback={null}>
      <NuevaPersonaForm />
    </Suspense>
  );
}
