import { getAllJornadasTrabajo } from "@/backend/src/queries/trabajos";
import { JornadasTrabajoListClient } from "./list-client";
export default async function JornadasTrabajoPage() {
  const data = await getAllJornadasTrabajo();
  return <JornadasTrabajoListClient initialData={data} />;
}
