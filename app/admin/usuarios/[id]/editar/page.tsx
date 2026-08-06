import { findUsuarioById } from "@/backend/src/queries/usuarios";
import { EditarUsuarioClient } from "./edit-client";

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await findUsuarioById(Number(id));
  if (!usuario) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[13px] text-danger">Usuario no encontrado</p>
      </div>
    );
  }
  // Solo se pasan campos seguros al cliente (NUNCA passwordHash).
  return (
    <EditarUsuarioClient
      data={{
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre ?? null,
        emailVerificado: usuario.emailVerificado,
        activo: usuario.activo,
        esAdmin: usuario.esAdmin,
      }}
    />
  );
}
