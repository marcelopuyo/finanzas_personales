import { getSessionUser } from "@/backend/src/lib/auth";
import { TrabajoWizard } from "./trabajo-wizard";

export default async function NuevoTrabajoPage({
  searchParams,
}: {
  searchParams: Promise<{ origen?: string }>;
}) {
  const { origen } = await searchParams;
  // Moneda predeterminada del usuario: es la del **precio por hora** (el héroe
  // del paso "Precio por hora" y su valor en la confirmación).
  const sessionUser = await getSessionUser();
  const monedaISO = sessionUser?.monedaPredeterminada?.codigoISO ?? "USD";
  return <TrabajoWizard origen={origen} monedaISO={monedaISO} />;
}
