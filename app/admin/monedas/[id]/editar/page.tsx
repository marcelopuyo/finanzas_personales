import { redirect } from "next/navigation";
import { isAdmin } from "@/backend/src/lib/auth";
import { getMonedaById } from "@/backend/src/queries/maestros";
import { EditarMonedaClient } from "./edit-client";

export default async function EditarMonedaPage({ params }: { params: Promise<{ id: string }> }) {
  // CRUD de monedas (tabla compartida): solo administradores.
  if (!(await isAdmin())) redirect("/dashboard");
  const { id } = await params;
  const d = await getMonedaById(Number(id));
  if (!d) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Moneda no encontrada</p></div>;
  return <EditarMonedaClient data={d} />;
}
