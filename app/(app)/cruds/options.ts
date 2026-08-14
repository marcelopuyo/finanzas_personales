"use server";

// Helpers centralizados para selects async de los formularios CRUD.
// Devuelven { value, label } directamente (lo que espera CrudForm).

import { getAllTiposCuenta, getAllMonedas, getAllPersonas, getAllCuentas } from "@/backend/src/queries/maestros";
import { getAllTarjetas, getAllPeriodosTarjeta, getAllMovimientosTarjeta } from "@/backend/src/queries/tarjetas";
import { getAllTrabajos, getAllPeriodosTrabajo } from "@/backend/src/queries/trabajos";

export async function fetchTiposCuenta() {
  const rows = await getAllTiposCuenta();
  return rows.map((r) => ({ value: r.nombre, label: r.nombre }));
}

export async function fetchMonedas() {
  const rows = await getAllMonedas();
  return rows.map((r) => ({
    value: r.nombre,
    label: `${r.simbolo} - ${r.nombre}`,
    flag: r.codigoPais,
  }));
}

export async function fetchPersonas() {
  const rows = await getAllPersonas();
  return rows.map((r) => ({ value: r.nombre, label: r.nombre }));
}

export async function fetchCuentas() {
  const rows = await getAllCuentas();
  return rows.map((r) => ({ value: r.nombre, label: r.nombre }));
}

// Variante con value = ID (para la cuenta de propina de las jornadas).
export async function fetchCuentasId() {
  const rows = await getAllCuentas();
  return rows.map((r) => ({
    value: String(r.id),
    label: r.moneda ? `${r.nombre} (${r.moneda.codigoISO})` : r.nombre,
  }));
}

export async function fetchTarjetas() {
  const rows = await getAllTarjetas();
  return rows.map((r) => ({ value: r.nombre, label: r.nombre }));
}

export async function fetchPeriodosTarjeta() {
  const rows = await getAllPeriodosTarjeta();
  return rows.map((r) => ({ value: r.nombre, label: r.nombre }));
}

export async function fetchTrabajos() {
  const rows = await getAllTrabajos();
  return rows.map((r) => ({ value: r.nombre, label: r.nombre }));
}

// Variante con value = ID (para el período automático de las jornadas).
export async function fetchTrabajosId() {
  const rows = await getAllTrabajos();
  return rows.map((r) => ({ value: String(r.id), label: r.nombre }));
}

/** Formatea "YYYY-MM-DD" (o Date) a "D/M/YYYY" sin problemas de zona horaria. */
function formatFecha(value: string | Date): string {
  let iso: string;
  if (typeof value === "string") {
    iso = value.slice(0, 10);
  } else if (value instanceof Date && !isNaN(value.getTime())) {
    iso = value.toISOString().slice(0, 10);
  } else {
    return String(value);
  }
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${parseInt(d, 10)}/${parseInt(m, 10)}/${y}`;
}

export async function fetchPeriodosTrabajo() {
  const rows = await getAllPeriodosTrabajo();
  // Solo períodos SIN fecha de cobro (null o fecha centinela < 1901-01-02,
  // misma lógica que el dashboard para "no cobrado").
  return rows
    .filter((r) => {
      if (!r.fechaDeCobro) return true;
      return new Date(r.fechaDeCobro) < new Date("1901-01-02");
    })
    .map((r) => ({
      value: String(r.id),
      label: `${r.trabajo?.nombre ?? "Trabajo"}: ${formatFecha(r.fechaDesde)} al ${formatFecha(r.fechaHasta)}`,
    }));
}

// Para Movimientos Tarjeta (opciones de movimiento, solo lectura de ejemplo)
export async function fetchMovimientosTarjetaOptions() {
  const rows = await getAllMovimientosTarjeta();
  return rows.map((r) => ({ value: r.id, label: r.detalle ?? r.id }));
}
