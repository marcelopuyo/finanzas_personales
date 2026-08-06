import { getCategoriaGastoById } from "@/backend/src/queries/gastos";
import { EditarCategoriaGastoClient } from "./edit-client";

export default async function EditarCategoriaGastoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getCategoriaGastoById(Number(id));
  if (!data) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Categoría no encontrada</p></div>;
  return <EditarCategoriaGastoClient data={data} />;
}
