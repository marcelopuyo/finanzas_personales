import { getCuentaById } from "@/backend/src/queries/maestros";
import { EditarCuentaClient } from "./edit-client";
export default async function EditarCuentaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ origen?: string }>;
}) {
  const { id } = await params;
  const { origen } = await searchParams;
  const d = await getCuentaById(Number(id));
  if (!d) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Cuenta no encontrada</p></div>;
  return <EditarCuentaClient data={d} origen={origen} />;
}
