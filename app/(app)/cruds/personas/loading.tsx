import { CrudSkeleton } from "@/components/ui/crud-skeleton";

/**
 * Fallback de navegación del CRUD de personas: la grilla con la lista.
 * (Comparte la forma con el resto de los CRUD: `components/ui/crud-skeleton.tsx`.)
 */
export default function Loading() {
  return <CrudSkeleton />;
}
