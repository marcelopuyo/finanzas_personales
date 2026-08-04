import { getPeriodoTrabajoById } from "@/backend/src/queries/trabajos";
import { EditarPeriodoTrabajoClient } from "./edit-client";
export default async function EditarPeriodoTrabajoPage({ params }: { params: { id: string } }) {
  const d = await getPeriodoTrabajoById(Number(params.id));
  if (!d) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Período no encontrado</p></div>;
  return <EditarPeriodoTrabajoClient data={d} />;
}
