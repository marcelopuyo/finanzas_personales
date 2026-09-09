import { getCategoriaGastoById } from "@/backend/src/queries/gastos";
import { EditarCategoriaGastoClient } from "./edit-client";

export default async function EditarCategoriaGastoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ origen?: string }>;
}) {
  const { id } = await params;
  const { origen } = await searchParams;
  const data = await getCategoriaGastoById(Number(id));
  if (!data) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Categoría no encontrada</p></div>;
  return <EditarCategoriaGastoClient data={data} origen={origen} />;
}
