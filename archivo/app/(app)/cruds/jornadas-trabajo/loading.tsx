import { CrudSkeleton } from "@/components/ui/crud-skeleton";

/** Fallback de navegación del CRUD de jornadas de trabajo (grilla de 5 filas,
    igual que el `rowsPerPage` del listado real). Ver `components/ui/crud-skeleton.tsx`. */
export default function Loading() {
  return <CrudSkeleton rows={5} />;
}
