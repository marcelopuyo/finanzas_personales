import { getJornadaTrabajoById } from "@/backend/src/queries/trabajos";
import { EditarJornadaTrabajoClient } from "./edit-client";
export default async function EditarJornadaTrabajoPage({ params }: { params: { id: string } }) {
  const d = await getJornadaTrabajoById(String(params.id));
  if (!d) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Jornada no encontrada</p></div>;
  return <EditarJornadaTrabajoClient data={d} />;
}
