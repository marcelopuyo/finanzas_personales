import { redirect } from "next/navigation";
import { isAdmin } from "@/backend/src/lib/auth";
import { NuevoConceptoClient } from "./nuevo-client";

export default async function NuevoConceptoPage() {
  // CRUD de conceptos: solo administradores.
  if (!(await isAdmin())) redirect("/dashboard");
  return <NuevoConceptoClient />;
}
