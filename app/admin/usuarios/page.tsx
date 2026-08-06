import { getAllUsuarios } from "@/backend/src/queries/usuarios";
import { UsuariosListClient } from "./list-client";

export default async function UsuariosPage() {
  const usuarios = await getAllUsuarios();
  return <UsuariosListClient initialData={usuarios} />;
}
