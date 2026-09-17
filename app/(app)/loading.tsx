import { CrudSkeleton } from "@/components/ui/crud-skeleton";

/**
 * Fallback de navegación genérico de TODA el área `(app)`: cubre las páginas que
 * no tienen un `loading.tsx` propio (Perfil, movimientos, wizards, etc.).
 *
 * Desde el 2026-09-17 cada CRUD tiene el suyo (misma forma: `CrudSkeleton`) y el
 * dashboard también. La forma base —encabezado + tarjeta con la grilla, mismo
 * padding— vive en `components/ui/crud-skeleton.tsx`.
 *
 * ⚠️ `sk-fade` (globals.css) retrasa la aparición ~150 ms: si la página llega
 * antes, el skeleton no se ve nunca (evita el parpadeo).
 */
export default function Loading() {
  return <CrudSkeleton />;
}
