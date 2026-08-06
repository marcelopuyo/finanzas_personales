import { redirect } from "next/navigation";
import { isAdmin } from "@/backend/src/lib/auth";
import { NuevaMonedaClient } from "./nuevo-client";

export default async function NuevaMonedaPage() {
  // CRUD de monedas (tabla compartida): solo administradores.
  if (!(await isAdmin())) redirect("/dashboard");
  return <NuevaMonedaClient />;
}
