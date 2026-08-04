import { getConceptoById } from "@/backend/src/queries/maestros";
import { EditarConceptoClient } from "./edit-client";

export default async function EditarConceptoPage({
  params,
}: {
  params: { id: string };
}) {
  const concepto = await getConceptoById(Number(params.id));
  if (!concepto) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[13px] text-danger">Concepto no encontrado</p>
      </div>
    );
  }
  return <EditarConceptoClient data={concepto} />;
}
