import { getGastoById } from "@/backend/src/queries/gastos";
import { EditarGastoClient } from "./edit-client";

export default async function EditarGastoPage({
  params,
}: {
  params: { id: string };
}) {
  const gasto = await getGastoById(String(params.id));
  if (!gasto) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[13px] text-danger">Gasto no encontrado</p>
      </div>
    );
  }
  return <EditarGastoClient data={gasto} />;
}
