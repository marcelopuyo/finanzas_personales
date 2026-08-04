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
  return rows.map((r) => ({ value: r.nombre, label: `${r.simbolo} - ${r.nombre}` }));
}

export async function fetchPersonas() {
  const rows = await getAllPersonas();
  return rows.map((r) => ({ value: r.nombre, label: r.nombre }));
}

export async function fetchCuentas() {
  const rows = await getAllCuentas();
  return rows.map((r) => ({ value: r.nombre, label: r.nombre }));
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

export async function fetchPeriodosTrabajo() {
  const rows = await getAllPeriodosTrabajo();
  return rows.map((r) => ({ value: String(r.id), label: `${r.trabajo?.nombre ?? "Trabajo"} (${String(r.fechaDesde).slice(0, 10)})` }));
}

// Para Movimientos Tarjeta (opciones de movimiento, solo lectura de ejemplo)
export async function fetchMovimientosTarjetaOptions() {
  const rows = await getAllMovimientosTarjeta();
  return rows.map((r) => ({ value: r.id, label: r.detalle ?? r.id }));
}
