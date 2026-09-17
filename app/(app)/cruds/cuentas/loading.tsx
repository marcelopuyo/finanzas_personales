import { CrudSkeleton } from "@/components/ui/crud-skeleton";

/** Fallback de navegación del CRUD de cuentas: grilla + (en mobile) tarjetas.
    Ver `components/ui/crud-skeleton.tsx`. */
export default function Loading() {
  return <CrudSkeleton />;
}
