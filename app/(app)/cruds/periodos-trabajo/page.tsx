import { getAllPeriodosTrabajo } from "@/backend/src/queries/trabajos";
import { PeriodosTrabajoListClient } from "./list-client";

export default async function PeriodosTrabajoPage({
  searchParams,
}: {
  searchParams: Promise<{ origen?: string }>;
}) {
  const { origen } = await searchParams;
  const data = await getAllPeriodosTrabajo();
  return <PeriodosTrabajoListClient initialData={data} origen={origen} />;
}
