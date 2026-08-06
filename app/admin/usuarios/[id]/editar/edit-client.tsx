"use client";

import { CrudForm } from "@/components/crud/CrudForm";
import { actualizarUsuarioAdmin } from "@/backend/src/actions/usuarios";
import {
  usuarioUpdateFormSchema,
  usuarioEditFields,
} from "../../usuario-form-config";

interface Props {
  data: {
    id: number;
    email: string;
    nombre: string | null;
    emailVerificado: boolean;
    activo: boolean;
    esAdmin: boolean;
  };
}

export function EditarUsuarioClient({ data }: Props) {
  return (
    <CrudForm
      title="Editar Usuario"
      fields={usuarioEditFields}
      schema={usuarioUpdateFormSchema}
      defaultValues={{
        email: data.email,
        nombre: data.nombre ?? "",
        emailVerificado: String(data.emailVerificado),
        activo: String(data.activo),
        esAdmin: String(data.esAdmin),
      }}
      onSubmit={async (f) => {
        await actualizarUsuarioAdmin(data.id, {
          email: f.email as string,
          nombre: (f.nombre as string) || undefined,
          password: (f.password as string) || undefined,
          emailVerificado: f.emailVerificado === "true",
          activo: f.activo === "true",
          esAdmin: f.esAdmin === "true",
        });
      }}
      cancelHref="/admin/usuarios"
      successMessage="Usuario actualizado correctamente"
    />
  );
}
