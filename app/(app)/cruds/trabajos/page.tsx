import { getAllTrabajos } from "@/backend/src/queries/trabajos";
import { TrabajosListClient } from "./list-client";

export default async function TrabajosPage({
  searchParams,
}: {
  searchParams: Promise<{ origen?: string }>;
}) {
  const { origen } = await searchParams;
  const data = await getAllTrabajos();
  return <TrabajosListClient initialData={data} origen={origen} />;
}
