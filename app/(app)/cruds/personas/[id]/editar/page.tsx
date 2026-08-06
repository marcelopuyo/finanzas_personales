import { getPersonaById } from "@/backend/src/queries/maestros"; import { EditarPersonaClient } from "./edit-client"; export default async function EditarPersonaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getPersonaById(Number(id)); if (!d) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Persona no encontrada</p></div>; return <EditarPersonaClient data={d} />; }
