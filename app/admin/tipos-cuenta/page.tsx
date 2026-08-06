import { redirect } from "next/navigation";
import { isAdmin } from "@/backend/src/lib/auth";
import { getAllTiposCuenta } from "@/backend/src/queries/maestros";
import { TiposCuentaListClient } from "./list-client";

export default async function TiposCuentaPage() {
  // CRUD de tipos de cuenta (tabla compartida): solo administradores.
  if (!(await isAdmin())) redirect("/dashboard");
  const data = await getAllTiposCuenta();
  return <TiposCuentaListClient initialData={data} />;
}
