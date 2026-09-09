import { getPrestamoById } from "@/backend/src/queries/prestamos";
import { EditarPrestamoClient } from "./edit-client";
export default async function EditarPrestamoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ origen?: string }>;
}) {
  const { id } = await params;
  const { origen } = await searchParams;
  const d = await getPrestamoById(String(id));
  if (!d) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Préstamo no encontrado</p></div>;
  return <EditarPrestamoClient data={d} origen={origen} />;
}
