import { redirect } from "next/navigation";
import { isAdmin } from "@/backend/src/lib/auth";
import {
  getAllCotizaciones,
  getAllMonedas,
} from "@/backend/src/queries/maestros";
import CotizacionesClient from "./cotizaciones-client";

export default async function AdminCotizacionesPage() {
  // Panel admin (layout ya exige esAdmin; se refuerza acá).
  if (!(await isAdmin())) redirect("/dashboard");

  const [cotizaciones, monedas] = await Promise.all([
    getAllCotizaciones().catch(() => []),
    getAllMonedas().catch(() => []),
  ]);

  return (
    <CotizacionesClient cotizaciones={cotizaciones} monedas={monedas} />
  );
}
