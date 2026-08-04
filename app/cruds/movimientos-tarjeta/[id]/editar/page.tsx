import { getMovimientoTarjetaById } from "@/backend/src/queries/tarjetas";
import { EditarMovimientoTarjetaClient } from "./edit-client";
export default async function EditarMovimientoTarjetaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getMovimientoTarjetaById(String(id));
  if (!d) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Movimiento no encontrado</p></div>;
  return <EditarMovimientoTarjetaClient data={d} />;
}
