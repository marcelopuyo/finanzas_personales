import { getMovimientoOptions } from "./movimiento-data";
import { MovimientoClient } from "./movimiento-client";

export default async function MovimientosPage() {
  const options = await getMovimientoOptions();
  // Fecha por defecto calculada en el servidor (determinista para SSR/hidratación).
  const fechaHoy = new Date().toISOString().slice(0, 10);
  return <MovimientoClient options={options} fechaHoy={fechaHoy} />;
}
