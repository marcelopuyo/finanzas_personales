import { getTipoCuentaById } from "@/backend/src/queries/maestros"; import { EditarTipoCuentaClient } from "./edit-client"; export default async function EditarTipoCuentaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getTipoCuentaById(Number(id)); if (!d) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Tipo de cuenta no encontrado</p></div>; return <EditarTipoCuentaClient data={d} />; }
