import { redirect } from "next/navigation";
import { isAdmin } from "@/backend/src/lib/auth";
import { NuevoTipoCuentaClient } from "./nuevo-client";

export default async function NuevoTipoCuentaPage() {
  // CRUD de tipos de cuenta (tabla compartida): solo administradores.
  if (!(await isAdmin())) redirect("/dashboard");
  return <NuevoTipoCuentaClient />;
}
