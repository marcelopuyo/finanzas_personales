"use client";
import { useParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { actualizarPersona } from "@/backend/src/actions/maestros";
import type { PersonaOut } from "@/backend/src/queries/maestros";
import { sufijoOrigen } from "@/lib/origen-crud";
import { personaSchema, personaFields } from "../../persona-form-config";
interface Props {
  data: PersonaOut;
  /** Origen de navegación (?origen=<vista del dashboard>): cancelar/guardar
      vuelven al listado conservándolo (mantiene la flecha "volver"). */
  origen?: string;
}
export function EditarPersonaClient({ data, origen }: Props) {
  const p = useParams();
  const destino = `/cruds/personas${sufijoOrigen(origen)}`;
  return <CrudForm title="Editar Persona" fields={personaFields} schema={personaSchema} defaultValues={{ nombre: data.nombre, telefono: data.telefono ?? "", mail: data.mail ?? "" }} onSubmit={async (f) => { await actualizarPersona(Number(p.id), { nombre: f.nombre as string, telefono: (f.telefono as string) || undefined, mail: (f.mail as string) || undefined }); }} cancelHref={destino} successHref={destino} successMessage="Persona actualizada correctamente" />;
}
