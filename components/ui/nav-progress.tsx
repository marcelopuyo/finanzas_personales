"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLinkStatus } from "next/link";
import { cn } from "@/lib/utils";

/**
 * Feedback de NAVEGACIÓN entre páginas (2026-09-14).
 *
 * En App Router no existen "router events", así que la barra de progreso global
 * se enciende desde el propio código que navega: el hook `usePendingNav()` (para
 * `router.push`) o `startNav()` a mano (p. ej. desde un menú). Se apaga sola
 * cuando cambia la ruta o, por seguridad, a los 10 s.
 *
 * ── Store mínimo a nivel de módulo ──────────────────────────────────────────
 * Vive fuera de React para poder avisar desde cualquier handler sin context.
 */
const subs = new Set<(v: boolean) => void>();
let activo = false;
let safety: ReturnType<typeof setTimeout> | null = null;

function avisar(v: boolean) {
  activo = v;
  subs.forEach((f) => f(v));
}

/** Enciende la barra de progreso global (llamar ANTES de navegar). */
export function startNav() {
  if (safety) clearTimeout(safety);
  // Seguro: si la navegación nunca se completa, la barra no queda pegada.
  safety = setTimeout(() => avisar(false), 10000);
  avisar(true);
}

/** Apaga la barra de progreso global. */
export function endNav() {
  if (safety) clearTimeout(safety);
  safety = null;
  avisar(false);
}

/**
 * Barra de progreso global: 3px pegados abajo de la top bar (h-14). Aparece
 * con un pequeño retraso (`.sk-fade`, 150 ms) para no parpadear en las
 * navegaciones instantáneas, y usa una animación "indeterminada" (crece rápido
 * y se frena) porque no sabemos cuánto tarda la página nueva.
 *
 * Se monta UNA vez, en `AppLayout`.
 */
export function NavProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(activo);
  /** Contador de activaciones: cambia la `key` y reinicia la animación. */
  const [run, setRun] = useState(0);

  useEffect(() => {
    const f = (v: boolean) => {
      setVisible(v);
      if (v) setRun((r) => r + 1);
    };
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  }, []);

  // Al cambiar de ruta, cualquier navegación pendiente se da por terminada.
  useEffect(() => {
    if (activo) endNav();
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="sk-fade pointer-events-none fixed top-14 right-0 left-0 z-60 h-0.75"
    >
      <div key={run} className="nav-bar h-full bg-primary" />
    </div>
  );
}

/**
 * Hook para navegaciones programáticas con feedback:
 *
 * ```tsx
 * const { pending, pendingKey, go } = usePendingNav();
 * <button onClick={() => go("/cruds/cuentas", "ver")} className={cn(pendingKey === "ver" && "opacity-60")} />
 * ```
 *
 * - `go(href, key?)` → enciende la barra global y navega dentro de una
 *   transición (React la mantiene "pending" hasta que la ruta nueva renderiza).
 * - `pending` / `pendingKey` → para pintar el elemento tocado (spinner, opacidad)
 *   mientras llega la página nueva.
 *
 * Para lo que sea un destino fijo conviene `<Link>` (prefetch automático ⇒ la
 * navegación suele ser instantánea y no hace falta ningún indicador).
 */
export function usePendingNav() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [key, setKey] = useState<string | null>(null);

  const go = useCallback(
    (href: string, k = "nav") => {
      startNav();
      setKey(k);
      startTransition(() => {
        router.push(href);
      });
    },
    [router]
  );

  return { pending, pendingKey: pending ? key : null, go };
}

/**
 * "Sensor" para navegaciones con `<Link>`: se renderiza DENTRO del `<Link>` (es
 * el único lugar donde `useLinkStatus()` puede leer el estado) y avisa a la
 * barra global mientras el destino está en camino. No pinta nada.
 *
 *   <Link href="/x"><LinkNavStatus />contenido</Link>
 */
export function LinkNavStatus() {
  const { pending } = useLinkStatus();

  useEffect(() => {
    if (pending) startNav();
  }, [pending]);

  return null;
}

/** Spinner chico reutilizable para el feedback de navegación. */
export function NavSpinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={cn(
        "inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
    />
  );
}

/**
 * PREFETCH AL PRIMER CONTACTO (2026-09-17).
 *
 * Para los destinos que NO pueden ser `<Link>` —una fila de grilla que se
 * resuelve por `data-row-id`, el ítem de un menú, un botón que arma la URL al
 * vuelo— este hook prefetchea el RSC **cuando el usuario toca o pasa el mouse
 * por el control**: la navegación se siente instantánea sin pagar el costo al
 * montar la pantalla (que es lo que hace un `<Link>` en el viewport).
 *
 * Se devuelve un CALLBACK para poder usarlo dentro de listas:
 *
 * ```tsx
 * const prefetch = usePrefetchNav();
 * <tr onTouchStart={() => prefetch(href)} onMouseEnter={() => prefetch(href)} />
 * ```
 *
 * Guarda los hrefs ya pedidos: repetir el prefetch en cada toque no aporta nada.
 */
export function usePrefetchNav() {
  const router = useRouter();
  const hechos = useRef(new Set<string>());

  return useCallback(
    (href: string | null | undefined) => {
      if (!href || hechos.current.has(href)) return;
      hechos.current.add(href);
      router.prefetch(href);
    },
    [router]
  );
}
