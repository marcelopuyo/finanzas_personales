import { dateTimeToString, numberToCurrency } from "@/lib/utils";

/**
 * Helpers de PRÉSTAMOS (2026-09-10, plan `plan-prestamos-persona-unica.md`).
 *
 * Un préstamo tiene UNA sola persona: la **contraparte** (la otra parte es
 * siempre el usuario de la app). Su rol se **deriva** de `sentido`:
 *  - `otorgado` (yo presto): la persona es el **Destinatario** → *te debe*.
 *  - `obtenido` (me prestan): la persona es el **Prestador** → *le debés*.
 *
 * Se usan en el formulario (label dinámico), la grilla, los combos del wizard y
 * el tooltip del gráfico del dashboard.
 */

/** Etiqueta de la relación con la contraparte, en 3ª persona (grilla/tooltip). */
export function fraseContraparte(sentido: string): string {
  return sentido === "obtenido" ? "le debés" : "te debe";
}

/** Rótulo del campo de contraparte según el sentido (label dinámico). */
export function labelContraparte(sentido: string): string {
  return sentido === "obtenido"
    ? "Prestador (quien te presta)"
    : "Destinatario (quien recibe)";
}

/** Datos mínimos para armar el rótulo de un préstamo en un combo. */
export interface PrestamoLabelInput {
  detalle: string | null;
  fecha: Date | string;
  saldo: number;
  sentido: string;
  monedaISO?: string;
  personaContraparte?: { nombre: string } | null;
}

/**
 * Etiqueta de una opción de préstamo en los combos del wizard.
 * Ej: `Olga — Prestamo viaje · Saldo US$ 400,00 · 09/07/2026 (te debe)`
 * (la contraparte va primero porque es por lo que se busca; el saldo en la
 * moneda REAL del préstamo, no en la predeterminada).
 */
export function prestamoLabel(p: PrestamoLabelInput): string {
  const nombre = p.personaContraparte?.nombre ?? "Sin persona";
  const detalle = p.detalle || "Préstamo";
  const saldo = numberToCurrency(p.saldo ?? 0, p.monedaISO ?? "ARS");
  const fecha = dateTimeToString(p.fecha);
  return `${nombre} — ${detalle} · Saldo ${saldo} · ${fecha} (${fraseContraparte(
    p.sentido
  )})`;
}
