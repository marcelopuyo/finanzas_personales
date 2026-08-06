import { getAllTrabajos } from "@/backend/src/queries/trabajos";
import { TrabajosListClient } from "./list-client";
export default async function TrabajosPage() {
  const data = await getAllTrabajos();
  return <TrabajosListClient initialData={data} />;
}
