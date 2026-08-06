import { getAllCotizaciones } from "@/backend/src/queries/maestros";
import { CotizacionesListClient } from "./list-client";
export default async function CotizacionesPage() {
  const data = await getAllCotizaciones();
  return <CotizacionesListClient initialData={data} />;
}
