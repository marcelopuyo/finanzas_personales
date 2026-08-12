import { getAllGastos } from "@/backend/src/queries/gastos";
import { getSessionUser } from "@/backend/src/lib/auth";
import { GastosListClient } from "./list-client";

export default async function GastosPage() {
  const [gastos, sessionUser] = await Promise.all([
    getAllGastos(),
    getSessionUser(),
  ]);
  // Símbolo de la moneda predeterminada del usuario en la tabla de gastos.
  const monedaISO = sessionUser?.monedaPredeterminada?.codigoISO ?? "USD";
  return <GastosListClient initialData={gastos} currency={monedaISO} />;
}
