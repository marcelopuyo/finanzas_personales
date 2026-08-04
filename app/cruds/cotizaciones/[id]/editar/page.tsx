import { getCotizacionById } from "@/backend/src/queries/maestros";
import { EditarCotizacionClient } from "./edit-client";
export default async function EditarCotizacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getCotizacionById(Number(id));
  if (!d) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Cotización no encontrada</p></div>;
  return <EditarCotizacionClient data={d} />;
}
