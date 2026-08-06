import { getMovimientoOptions } from "./movimiento-data";
import { MovimientoClient } from "./movimiento-client";
import { todayLocalISODate } from "@/lib/utils";

export default async function MovimientosPage() {
  const options = await getMovimientoOptions();
  // Fecha por defecto calculada en el servidor (determinista para SSR/hidratación).
  // Usa la fecha LOCAL (no UTC): `toISOString()` puede dar el día siguiente en GMT-3.
  const fechaHoy = todayLocalISODate();
  return <MovimientoClient options={options} fechaHoy={fechaHoy} />;
}
