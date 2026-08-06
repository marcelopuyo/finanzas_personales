import { getAllCategoriasGasto } from "@/backend/src/queries/gastos";
import { CategoriasGastoListClient } from "./list-client";

export default async function CategoriasGastoPage() {
  const data = await getAllCategoriasGasto();
  return <CategoriasGastoListClient initialData={data} />;
}
