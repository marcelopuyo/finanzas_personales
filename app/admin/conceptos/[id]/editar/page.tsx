import { redirect } from "next/navigation";
import { isAdmin } from "@/backend/src/lib/auth";
import { getConceptoById } from "@/backend/src/queries/maestros";
import { EditarConceptoClient } from "./edit-client";

export default async function EditarConceptoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) redirect("/dashboard");
  const { id } = await params;
  const concepto = await getConceptoById(Number(id));
  if (!concepto) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[13px] text-danger">Concepto no encontrado</p>
      </div>
    );
  }
  return <EditarConceptoClient data={concepto} />;
}
