"use client";

import { useSyncExternalStore } from "react";
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
