import { getAllPrestamos } from "@/backend/src/queries/prestamos";
import { PrestamosListClient } from "./list-client";
export default async function PrestamosPage() {
  const data = await getAllPrestamos();
  return <PrestamosListClient initialData={data} />;
}
