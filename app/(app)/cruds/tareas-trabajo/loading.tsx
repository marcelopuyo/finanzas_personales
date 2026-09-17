import { CrudSkeleton } from "@/components/ui/crud-skeleton";

/** Fallback de navegación del CRUD de tareas de trabajo.
    Ver `components/ui/crud-skeleton.tsx`. */
export default function Loading() {
  return <CrudSkeleton rows={5} />;
}
