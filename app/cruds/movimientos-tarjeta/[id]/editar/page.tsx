import { getMovimientoTarjetaById } from "@/backend/src/queries/tarjetas";
import { EditarMovimientoTarjetaClient } from "./edit-client";
export default async function EditarMovimientoTarjetaPage({ params }: { params: { id: string } }) {
  const d = await getMovimientoTarjetaById(String(params.id));
  if (!d) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Movimiento no encontrado</p></div>;
  return <EditarMovimientoTarjetaClient data={d} />;
}
