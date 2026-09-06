import { NuevoPeriodoDeTrabajo } from "./periodo-nuevo-client";

export default async function NuevoPeriodoTrabajoPage({
  searchParams,
}: {
  searchParams: Promise<{ origen?: string }>;
}) {
  const { origen } = await searchParams;
  return <NuevoPeriodoDeTrabajo origen={origen} />;
}

