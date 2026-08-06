import { redirect } from "next/navigation";
import { isAdmin } from "@/backend/src/lib/auth";
import { getAllMonedas } from "@/backend/src/queries/maestros";
import { MonedasListClient } from "./list-client";

export default async function MonedasPage() {
  // CRUD de monedas (tabla compartida): solo administradores.
  if (!(await isAdmin())) redirect("/dashboard");
  const data = await getAllMonedas();
  return <MonedasListClient initialData={data} />;
}
