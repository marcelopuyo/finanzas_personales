import { getAllPrestamos } from "@/backend/src/queries/prestamos";
import { PrestamosListClient } from "./list-client";
export default async function PrestamosPage({
  searchParams,
}: {
  searchParams: Promise<{ origen?: string }>;
}) {
  const { origen } = await searchParams;
  const data = await getAllPrestamos();
  return <PrestamosListClient initialData={data} origen={origen} />;
}
