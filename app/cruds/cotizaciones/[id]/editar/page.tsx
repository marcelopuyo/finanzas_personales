import { getCotizacionById } from "@/backend/src/queries/maestros";
import { EditarCotizacionClient } from "./edit-client";
export default async function EditarCotizacionPage({ params }: { params: { id: string } }) {
  const d = await getCotizacionById(Number(params.id));
  if (!d) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Cotización no encontrada</p></div>;
  return <EditarCotizacionClient data={d} />;
}
