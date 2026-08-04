import { getTarjetaById } from "@/backend/src/queries/tarjetas";
import { EditarTarjetaClient } from "./edit-client";
export default async function EditarTarjetaPage({ params }: { params: { id: string } }) {
  const d = await getTarjetaById(Number(params.id));
  if (!d) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Tarjeta no encontrada</p></div>;
  return <EditarTarjetaClient data={d} />;
}
