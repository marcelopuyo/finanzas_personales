import { getAllPeriodosTarjeta } from "@/backend/src/queries/tarjetas";
import { PeriodosTarjetaListClient } from "./list-client";
export default async function PeriodosTarjetaPage() {
  const data = await getAllPeriodosTarjeta();
  return <PeriodosTarjetaListClient initialData={data} />;
}
