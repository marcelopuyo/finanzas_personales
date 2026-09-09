import { getCuentasConSaldoEnPredeterminada } from "@/backend/src/queries/maestros";
import { CuentasListClient } from "./list-client";

export default async function CuentasPage({
  searchParams,
}: {
  searchParams: Promise<{ origen?: string }>;
}) {
  const { origen } = await searchParams;
  // Incluye el saldo de cada cuenta convertido a la moneda predeterminada del
  // usuario (para que la sumatoria del export PDF quede en esa moneda).
  const { cuentas, monedaPredeterminadaISO } =
    await getCuentasConSaldoEnPredeterminada();
  return (
    <CuentasListClient
      initialData={cuentas}
      origen={origen}
      currency={monedaPredeterminadaISO}
    />
  );
}
