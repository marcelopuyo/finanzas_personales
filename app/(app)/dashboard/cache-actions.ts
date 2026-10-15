"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/backend/src/lib/auth";

/** Invalida las rutas cuyos datos comparten cuentas, gastos e ingresos. */
export async function invalidarCacheSeccionesDashboard(): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("La sesión expiró; vuelve a iniciar sesión.");

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/gastos");
  revalidatePath("/dashboard/ingresos");
  revalidatePath("/dashboard/resultados");
}
