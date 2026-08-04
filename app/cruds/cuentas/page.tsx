import { getAllCuentas } from "@/backend/src/queries/maestros";
import { CuentasListClient } from "./list-client";
export default async function CuentasPage() {
  const data = await getAllCuentas();
  return <CuentasListClient initialData={data} />;
}
