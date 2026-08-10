import { getMovimientoOptions } from "./movimiento-data";
import { MovimientoClient } from "./movimiento-client";
import { todayLocalISODate } from "@/lib/utils";
import {
  MOVIMIENTO_TIPO_PARAM,
  type MovimientoConcepto,
  type MovimientoInitial,
} from "./stepper/types";

/** Params de URL para precargar el wizard desde las tarjetas del dashboard. */
type MovimientosSearchParams = {
  tipo?: string;
  cuenta?: string;
  origen?: string;
  destino?: string;
};

function parseMovimientoInitial(
  params: MovimientosSearchParams
): MovimientoInitial | undefined {
  if (!params.tipo) return undefined;
  const concepto = (
    Object.entries(MOVIMIENTO_TIPO_PARAM) as [MovimientoConcepto, string][]
  ).find(([, valor]) => valor === params.tipo)?.[0];
  if (!concepto) return undefined;

  const num = (v?: string) =>
    v && Number.isFinite(Number(v)) ? Number(v) : undefined;
  return {
    concepto,
    cuenta: num(params.cuenta),
    origen: num(params.origen),
    destino: num(params.destino),
  };
}

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<MovimientosSearchParams>;
}) {
  const params = await searchParams;
  const options = await getMovimientoOptions();
  // Fecha por defecto calculada en el servidor (determinista para SSR/hidratación).
  // Usa la fecha LOCAL (no UTC): `toISOString()` puede dar el día siguiente en GMT-3.
  const fechaHoy = todayLocalISODate();
  const initial = parseMovimientoInitial(params);
  return <MovimientoClient options={options} fechaHoy={fechaHoy} initial={initial} />;
}
