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

/**
 * Formatea una fecha ISO a string local (dd/mm/aaaa).
 */
export function dateToLocaleDateString(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("es-ES");
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
 * Convierte Date a string dd-mm-aaaa.
 * Las fechas llegan como medianoche UTC desde SQL Server: se formatean con
 * partes UTC para evitar el corrimiento de día por zona horaria.
 */
export function dateTimeToString(date?: Date | string): string {
  if (!date) return "";
  const param = new Date(date);
  const anio = param.getUTCFullYear();
  const mes = String(param.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(param.getUTCDate()).padStart(2, "0");
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
