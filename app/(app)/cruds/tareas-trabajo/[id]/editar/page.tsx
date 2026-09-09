import { getTareaTrabajoById } from "@/backend/src/queries/trabajos";
import { EditarTareaTrabajoClient } from "./edit-client";

export default async function EditarTareaTrabajoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periodoFijo?: string; volverA?: string }>;
}) {
  const [{ id }, qs] = await Promise.all([params, searchParams]);
  const d = await getTareaTrabajoById(id);
  if (!d)
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-danger">Tarea no encontrada</p>
      </div>
    );
  return (
    <EditarTareaTrabajoClient
      data={d}
      periodoFijo={qs.periodoFijo === "1"}
      volverA={qs.volverA}
    />
  );
}
