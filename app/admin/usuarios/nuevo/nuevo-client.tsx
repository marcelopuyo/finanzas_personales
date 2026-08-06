"use client";

import { CrudForm } from "@/components/crud/CrudForm";
import { crearUsuarioAdmin } from "@/backend/src/actions/usuarios";
import {
  usuarioCreateFormSchema,
  usuarioCreateFields,
} from "../usuario-form-config";

export function NuevoUsuarioClient() {
  return (
    <CrudForm
      title="Nuevo Usuario"
      fields={usuarioCreateFields}
      schema={usuarioCreateFormSchema}
      defaultValues={{ activo: "true", esAdmin: "false" }}
      onSubmit={async (data) => {
        await crearUsuarioAdmin({
          email: data.email as string,
          password: data.password as string,
          nombre: (data.nombre as string) || undefined,
          activo: data.activo === "true",
          esAdmin: data.esAdmin === "true",
        });
      }}
      cancelHref="/admin/usuarios"
      successMessage="Usuario creado correctamente"
    />
  );
}
