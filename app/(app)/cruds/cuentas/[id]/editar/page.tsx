import { getCuentaById } from "@/backend/src/queries/maestros";
import { EditarCuentaClient } from "./edit-client";
export default async function EditarCuentaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getCuentaById(Number(id));
  if (!d) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Cuenta no encontrada</p></div>;
  return <EditarCuentaClient data={d} />;
}
