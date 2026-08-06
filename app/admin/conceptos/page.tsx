import { redirect } from "next/navigation";
import { isAdmin } from "@/backend/src/lib/auth";
import { getAllConceptos } from "@/backend/src/queries/maestros";
import { ConceptosListClient } from "./list-client";

export default async function ConceptosPage() {
  // CRUD de conceptos: solo administradores.
  if (!(await isAdmin())) redirect("/dashboard");
  const conceptos = await getAllConceptos();
  return <ConceptosListClient initialData={conceptos} />;
}
