import { getAllPeriodosTrabajo } from "@/backend/src/queries/trabajos";
import { PeriodosTrabajoListClient } from "./list-client";
export default async function PeriodosTrabajoPage() {
  const data = await getAllPeriodosTrabajo();
  return <PeriodosTrabajoListClient initialData={data} />;
}
