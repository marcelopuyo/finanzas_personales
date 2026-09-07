import { TrabajoWizard } from "./trabajo-wizard";

export default async function NuevoTrabajoPage({
  searchParams,
}: {
  searchParams: Promise<{ origen?: string }>;
}) {
  const { origen } = await searchParams;
  return <TrabajoWizard origen={origen} />;
}
