import { getAllGastos } from "@/backend/src/queries/gastos";
import { GastosListClient } from "./list-client";

export default async function GastosPage() {
  const gastos = await getAllGastos();
  return <GastosListClient initialData={gastos} />;
}
