import { CrudSkeleton } from "@/components/ui/crud-skeleton";

/** Fallback de navegación del CRUD de períodos de trabajo (la grilla muestra 5
    filas por página). Ver `components/ui/crud-skeleton.tsx`. */
export default function Loading() {
  return <CrudSkeleton rows={5} />;
}
