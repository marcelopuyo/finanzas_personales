"use client";

import { useCallback, useSyncExternalStore } from "react";
import { leerUltimoEmail } from "./ultimo-email";

/**
 * Suscripción vacía: los valores de estos hooks no cambian mientras la página
 * vive, así que no hay nada a lo que suscribirse.
 */
const suscribirNada = () => () => {};

/**
 * `false` durante el SSR **y** durante el render de hidratación; `true` una vez
 * hidratado. Sirve para calcular valores que sólo existen en el navegador
 * (fecha local, cookies, `matchMedia`, `localStorage`…) sin romper la
 * hidratación: el HTML del servidor y el primer render del cliente coinciden y,
 * apenas termina la hidratación, React re-renderiza con el valor real.
 *
 * Reemplaza al patrón `useState(false)` + `useEffect(() => setState(true))`,
 * que provocaba un render en cascada (`react-hooks/set-state-in-effect`).
 */
export function useMontado(): boolean {
  return useSyncExternalStore(suscribirNada, () => true, () => false);
}

/**
 * Último email con el que se inició sesión en este dispositivo (ver
 * `lib/ultimo-email.ts`), para **prefijar el campo Email del login**.
 *
 * Devuelve `""` en el servidor y en el render de hidratación, y el valor real
 * apenas hidrata: el campo se completa sin romper la hidratación y sin
 * `setState` dentro de un efecto.
 */
export function useUltimoEmail(): string {
  return useSyncExternalStore(suscribirNada, leerUltimoEmail, () => "");
}

/**
 * ¿La ventana cumple la media query? `false` en el SSR y en el render de
 * hidratación (igual que `useMontado`) y el valor real apenas hidrata,
 * actualizándose al redimensionar.
 *
 * A diferencia de las clases `lg:` de Tailwind, esto sirve para **comportamiento**
 * (no para estilos): p. ej. apagar un gesto táctil en pantallas grandes.
 */
export function useMediaQuery(query: string): boolean {
  const suscribir = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query]
  );
  return useSyncExternalStore(
    suscribir,
    () => window.matchMedia(query).matches,
    () => false
  );
}
