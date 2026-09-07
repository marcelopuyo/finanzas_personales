import { getAllCuentas } from "@/backend/src/queries/maestros";
import { CuentasListClient } from "./list-client";

export default async function CuentasPage({
  searchParams,
}: {
  searchParams: Promise<{ origen?: string }>;
}) {
  const { origen } = await searchParams;
  const data = await getAllCuentas();
  return <CuentasListClient initialData={data} origen={origen} />;
}
