import { getPeriodoTrabajoById } from "@/backend/src/queries/trabajos";
import { EditarPeriodoTrabajoClient } from "./edit-client";
export default async function EditarPeriodoTrabajoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getPeriodoTrabajoById(Number(id));
  if (!d) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Período no encontrado</p></div>;
  return <EditarPeriodoTrabajoClient data={d} />;
}
