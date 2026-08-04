import { getPrestamoById } from "@/backend/src/queries/prestamos";
import { EditarPrestamoClient } from "./edit-client";
export default async function EditarPrestamoPage({ params }: { params: { id: string } }) {
  const d = await getPrestamoById(String(params.id));
  if (!d) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Préstamo no encontrado</p></div>;
  return <EditarPrestamoClient data={d} />;
}
