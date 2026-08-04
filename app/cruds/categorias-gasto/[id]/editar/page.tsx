import { getCategoriaGastoById } from "@/backend/src/queries/gastos";
import { EditarCategoriaGastoClient } from "./edit-client";

export default async function EditarCategoriaGastoPage({ params }: { params: { id: string } }) {
  const data = await getCategoriaGastoById(Number(params.id));
  if (!data) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Categoría no encontrada</p></div>;
  return <EditarCategoriaGastoClient data={data} />;
}
