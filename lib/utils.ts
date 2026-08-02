import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un número como moneda ARS.
 */
export function numberToCurrency(value: number): string {
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
  });
}

/**
 * Formatea una fecha ISO a string local (dd/mm/aaaa).
 */
export function dateToLocaleDateString(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("es-ES");
}

/**
 * Normaliza una fecha a mediodía UTC (para comparaciones sin hora).
 */
export function dateTimeToDate(date?: Date | string): Date {
  const param = date ? new Date(date) : new Date();
  const anio = param.getFullYear();
  const mes = String(param.getMonth() + 1).padStart(2, "0");
  const dia = String(param.getDate() + 1).padStart(2, "0");
  return new Date(`${anio}-${mes}-${dia}T12:00:00.000Z`);
}

/**
 * Convierte Date a string dd-mm-aaaa.
 */
export function dateTimeToString(date?: Date | string): string {
  if (!date) return "";
  const param = new Date(date);
  const anio = param.getFullYear();
  const mes = String(param.getMonth() + 1).padStart(2, "0");
  const dia = String(param.getDate() + 1).padStart(2, "0");
  return `${dia}-${mes}-${anio}`;
}

/**
 * Retorna el timestamp de una fecha sin horas (para comparar días).
 */
export function onlyDate(date?: Date | string): number {
  const d = date ? new Date(date) : new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Retorna un string ISO de fecha (yyyy-mm-dd) desde un Date.
 */
export function toISODateString(date: Date): string {
  return date.toISOString().split("T")[0];
}
