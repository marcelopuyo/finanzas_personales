import { getAllPeriodosTrabajo } from "@/backend/src/queries/trabajos";
import { getSessionUser } from "@/backend/src/lib/auth";
import { PeriodosTrabajoListClient } from "./list-client";

export default async function PeriodosTrabajoPage({
  searchParams,
}: {
  searchParams: Promise<{ origen?: string }>;
}) {
  const { origen } = await searchParams;
  // Moneda predeterminada del usuario: la usan el gráfico de actividad
  // (Jornadas/Tareas) y los montos de la grilla/PDF (mismo criterio que el
  // dashboard de ingresos y el CRUD de gastos).
  const [data, sessionUser] = await Promise.all([
    getAllPeriodosTrabajo(),
    getSessionUser(),
  ]);
  const monedaISO = sessionUser?.monedaPredeterminada?.codigoISO ?? "USD";
  return (
    <PeriodosTrabajoListClient
      initialData={data}
      origen={origen}
      currency={monedaISO}
    />
  );
}
