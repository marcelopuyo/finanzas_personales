import { getTrabajoById } from "@/backend/src/queries/trabajos";
import { EditarTrabajoClient } from "./edit-client";
export default async function EditarTrabajoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ origen?: string }>;
}) {
  const { id } = await params;
  const { origen } = await searchParams;
  const d = await getTrabajoById(Number(id));
  if (!d) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Trabajo no encontrado</p></div>;
  return <EditarTrabajoClient data={d} origen={origen} />;
}
