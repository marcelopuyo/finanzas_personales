import { getAllConceptos } from "@/backend/src/queries/maestros";
import { ConceptosListClient } from "./list-client";

export default async function ConceptosPage() {
  const conceptos = await getAllConceptos();
  return <ConceptosListClient initialData={conceptos} />;
}
