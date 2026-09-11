import { getCuentasConSaldoEnPredeterminada } from "@/backend/src/queries/maestros";
import { CuentasListClient } from "./list-client";

export default async function CuentasPage({
  searchParams,
}: {
  searchParams: Promise<{ origen?: string }>;
}) {
  const { origen } = await searchParams;
  // Incluye el saldo de cada cuenta convertido a la moneda predeterminada del
  // usuario (para que la sumatoria del export PDF quede en esa moneda) y los
  // datos de la fila sintética de préstamos (§13: neto + flag del balance).
  const {
    cuentas,
    monedaPredeterminadaISO,
    monedaPredeterminada,
    prestamosNeto,
    incluirPrestamosEnBalance,
  } = await getCuentasConSaldoEnPredeterminada();
  return (
    <CuentasListClient
      initialData={cuentas}
      origen={origen}
      currency={monedaPredeterminadaISO}
      monedaPredeterminada={monedaPredeterminada}
      prestamosNeto={prestamosNeto}
      incluirPrestamosEnBalance={incluirPrestamosEnBalance}
    />
  );
}
