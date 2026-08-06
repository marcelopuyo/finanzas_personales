import { getInflacionById } from "@/backend/src/queries/maestros"; import { EditarInflacionClient } from "./edit-client"; export default async function EditarInflacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getInflacionById(Number(id)); if (!d) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Inflación no encontrada</p></div>; return <EditarInflacionClient data={d} />; }
