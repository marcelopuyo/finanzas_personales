import { getAllMovimientosTarjeta } from "@/backend/src/queries/tarjetas";
import { MovimientosTarjetaListClient } from "./list-client";
export default async function MovimientosTarjetaPage() {
  const data = await getAllMovimientosTarjeta();
  return <MovimientosTarjetaListClient initialData={data} />;
}
