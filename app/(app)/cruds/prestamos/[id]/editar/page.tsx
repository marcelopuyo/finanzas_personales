import { getPrestamoById } from "@/backend/src/queries/prestamos";
import { EditarPrestamoClient } from "./edit-client";
export default async function EditarPrestamoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getPrestamoById(String(id));
  if (!d) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Préstamo no encontrado</p></div>;
  return <EditarPrestamoClient data={d} />;
}
