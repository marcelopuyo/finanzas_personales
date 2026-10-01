import { getPeriodoTarjetaById } from "@/backend/src/queries/tarjetas";
import { EditarPeriodoTarjetaClient } from "./edit-client";
export default async function EditarPeriodoTarjetaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getPeriodoTarjetaById(Number(id));
  if (!d) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Período no encontrado</p></div>;
  return <EditarPeriodoTarjetaClient data={d} />;
}
