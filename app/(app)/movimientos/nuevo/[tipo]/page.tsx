import { redirect } from "next/navigation";
import { getMovimientoOptions } from "../../movimiento-data";
import { MovimientoClient } from "../../movimiento-client";
import { todayLocalISODate } from "@/lib/utils";
import {
  MOVIMIENTO_TIPO_PARAM,
  type MovimientoConcepto,
  type MovimientoInitial,
} from "../../stepper/types";

/**
 * Entrada directa a un movimiento (sin stepper): cada tipo tiene su ruta
 * `/movimientos/nuevo/<tipo>` y precarga la cuenta desde las tarjetas.
 * Reutiliza la maquinaria del wizard en "modo directo" (sin selector ni
 * progreso); el stepper original sigue vivo en `/movimientos`.
 */
export default async function MovimientoNuevoPage({
  params,
  searchParams,
}: {
  params: Promise<{ tipo: string }>;
  searchParams: Promise<{
    cuenta?: string;
    origen?: string;
    destino?: string;
  }>;
}) {
  const [{ tipo }, qs] = await Promise.all([params, searchParams]);
  const concepto = (
    Object.entries(MOVIMIENTO_TIPO_PARAM) as [MovimientoConcepto, string][]
  ).find(([, valor]) => valor === tipo)?.[0];
  if (!concepto) redirect("/movimientos");

  const num = (v?: string) =>
    v && Number.isFinite(Number(v)) ? Number(v) : undefined;
  const initial: MovimientoInitial = {
    concepto,
    cuenta: num(qs.cuenta),
    origen: num(qs.origen),
    destino: num(qs.destino),
  };

  const options = await getMovimientoOptions();
  const fechaHoy = todayLocalISODate();
  return (
    <MovimientoClient
      options={options}
      fechaHoy={fechaHoy}
      initial={initial}
      direct
    />
  );
}
