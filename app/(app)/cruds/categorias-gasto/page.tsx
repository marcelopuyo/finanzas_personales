import { getAllCategoriasGasto } from "@/backend/src/queries/gastos";
import { CategoriasGastoListClient } from "./list-client";

export default async function CategoriasGastoPage({
  searchParams,
}: {
  searchParams: Promise<{ origen?: string }>;
}) {
  const { origen } = await searchParams;
  const data = await getAllCategoriasGasto();
  return <CategoriasGastoListClient initialData={data} origen={origen} />;
}
