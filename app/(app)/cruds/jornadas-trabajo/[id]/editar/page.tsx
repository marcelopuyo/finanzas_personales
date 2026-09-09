import { getJornadaTrabajoById } from "@/backend/src/queries/trabajos";
import { EditarJornadaTrabajoClient } from "./edit-client";

export default async function EditarJornadaTrabajoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periodoFijo?: string; volverA?: string }>;
}) {
  const [{ id }, qs] = await Promise.all([params, searchParams]);
  const d = await getJornadaTrabajoById(String(id));
  if (!d)
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-danger">Jornada no encontrada</p>
      </div>
    );
  return (
    <EditarJornadaTrabajoClient
      data={d}
      periodoFijo={qs.periodoFijo === "1"}
      volverA={qs.volverA}
    />
  );
}
