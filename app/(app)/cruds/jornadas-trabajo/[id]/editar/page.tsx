import { getJornadaTrabajoById } from "@/backend/src/queries/trabajos";
import { EditarJornadaTrabajoClient } from "./edit-client";
export default async function EditarJornadaTrabajoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getJornadaTrabajoById(String(id));
  if (!d) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Jornada no encontrada</p></div>;
  return <EditarJornadaTrabajoClient data={d} />;
}
