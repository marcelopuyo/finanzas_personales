import { getAllTareasTrabajo } from "@/backend/src/queries/trabajos";
import { TareasTrabajoListClient } from "./list-client";
export default async function TareasTrabajoPage() {
  const data = await getAllTareasTrabajo();
  return <TareasTrabajoListClient initialData={data} />;
}
