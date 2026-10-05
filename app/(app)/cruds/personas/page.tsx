import { getAllPersonas } from "@/backend/src/queries/maestros";
import { PersonasListClient } from "./list-client";

export default async function PersonasPage({
  searchParams,
}: {
  searchParams: Promise<{ origen?: string }>;
}) {
  const { origen } = await searchParams;
  const data = await getAllPersonas();
  return <PersonasListClient initialData={data} origen={origen} />;
}
