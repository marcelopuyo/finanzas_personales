import { getPeriodoGastoById } from "@/backend/src/queries/gastos"; import { EditarPeriodoGastoClient } from "./edit-client"; export default async function EditarPeriodoGastoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getPeriodoGastoById(Number(id)); if (!d) return <div className="flex h-64 items-center justify-center"><p className="text-danger">Período no encontrado</p></div>; return <EditarPeriodoGastoClient data={d} />; }
