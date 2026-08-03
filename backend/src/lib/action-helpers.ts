import { revalidatePath } from "next/cache";

// Invalida la caché de la app tras cada mutación.
// TODO (Fase 10): afinar a las rutas CRUD específicas de cada entidad.
export function refresh() {
  revalidatePath("/", "layout");
}

// Traduce errores de unicidad / inesperados a mensajes amigables.
export function dbError(error: unknown, entity: string): never {
  const err = error as { number?: number; message?: string };
  if (err?.number === 2627) {
    throw new Error(`${entity} existente`);
  }
  throw new Error(`Error inesperado: ${err?.message ?? "desconocido"}`);
}
