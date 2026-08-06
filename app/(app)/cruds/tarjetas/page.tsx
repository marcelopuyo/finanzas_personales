import { getAllTarjetas } from "@/backend/src/queries/tarjetas";
import { TarjetasListClient } from "./list-client";
export default async function TarjetasPage() {
  const data = await getAllTarjetas();
  return <TarjetasListClient initialData={data} />;
}
