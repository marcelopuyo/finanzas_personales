import { getTareaTrabajoById } from "@/backend/src/queries/trabajos";
import { EditarTareaTrabajoClient } from "./edit-client";
export default async function EditarTareaTrabajoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const d = await getTareaTrabajoById(id);
  if (!d)
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-danger">Tarea no encontrada</p>
      </div>
    );
  return <EditarTareaTrabajoClient data={d} />;
}
