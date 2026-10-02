import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un número como moneda. Por defecto ARS; se puede pasar el código
 * ISO 4217 (ej. "USD") para que el símbolo corresponda a la moneda.
 */
export function numberToCurrency(value: number, currency = "ARS"): string {
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency,
  });
}

/** Símbolo de una moneda (ej. `US$`, `$`) a partir del código ISO 4217: se
 *  formatea 0 y se quitan dígitos, separadores y espacios. */
export function simboloMoneda(iso: string): string {
  return numberToCurrency(0, iso).replace(/[0-9.,\s\u00a0]/g, "");
}

/**
 * "YYYY-MM-DD…" → "dd-mm-aa" cortando el string (nunca se parsea, así no hay
 * corrimiento de día por zona horaria).
 *
 * **Formato ÚNICO de fecha de la app** (decisión del usuario, 2026-09-27): día
 * primero y año de 2 dígitos. Lo usan tablas, grillas, PDF y los selectores.
 */
export function isoADdMmAa(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y.slice(-2)}`;
}
/**
 * Convierte hora decimal (formato backend HH.MM, ej. 17.3 = 17:30) a string "HH:MM".
 */
export function decimalToTime(value: number): string {
  const hours = Math.trunc(value);
  const minutes = Math.round((value - hours) * 100);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Convierte "HH:MM" a hora decimal del backend (HH.MM, ej. "17:30" -> 17.3).
 */
export function timeToDecimal(value: string): number {
  const [h, m] = value.split(":").map((n) => parseInt(n, 10) || 0);
  return h + m / 100;
}
/**
 * Normaliza una fecha a mediodía UTC (para comparaciones sin hora).
 */
export function dateTimeToDate(date?: Date | string): Date {
  const param = date ? new Date(date) : new Date();
  param.setUTCHours(12, 0, 0, 0);
  return param;
}

/**
 * Convierte una fecha a **"dd-mm-aa"**, el formato ÚNICO de la app.
 *
 * - Un **string** ISO se corta tal cual (`isoADdMmAa`): nunca se parsea.
 * - Un **Date** (columnas `date` que llegan como medianoche UTC) se formatea
 *   con partes UTC para evitar el corrimiento de día por zona horaria.
 */
export function dateTimeToString(date?: Date | string): string {
  if (!date) return "";
  if (typeof date === "string") return isoADdMmAa(date);
  if (Number.isNaN(date.getTime())) return "";
  const anio = String(date.getUTCFullYear()).slice(-2);
  const mes = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(date.getUTCDate()).padStart(2, "0");
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

/**
 * Retorna la fecha de HOY como "YYYY-MM-DD" usando componentes LOCALES
 * (getFullYear/getMonth/getDate). NO usar `toISOString()` para "hoy": devuelve
 * la fecha UTC y en zonas con offset negativo (ej. GMT-3) por la noche puede
 * caer en el día SIGUIENTE, desfasando las fechas guardadas (±1 día).
 */
export function todayLocalISODate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
