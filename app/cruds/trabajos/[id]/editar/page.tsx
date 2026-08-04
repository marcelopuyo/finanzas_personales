import { getTrabajoById } from "@/backend/src/queries/trabajos";
import { EditarTrabajoClient } from "./edit-client";
export default async function EditarTrabajoPage({ params }: { params: { id: string } }) {
  const d = await getTrabajoById(Number(params.id));
  if (!d) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Trabajo no encontrado</p></div>;
  return <EditarTrabajoClient data={d} />;
}
