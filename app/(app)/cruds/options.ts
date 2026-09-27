"use server";

// Helpers centralizados para selects async de los formularios CRUD.
// Devuelven { value, label } directamente (lo que espera CrudForm).

import { getAllTiposCuenta, getAllMonedas, getAllPersonas, getAllCuentas } from "@/backend/src/queries/maestros";
import { getAllTarjetas, getAllPeriodosTarjeta, getAllMovimientosTarjeta } from "@/backend/src/queries/tarjetas";
import { getAllTrabajos } from "@/backend/src/queries/trabajos";

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

/**
 * Cuentas con saldo MAYOR A 0 (para el ALTA de préstamos: no tiene sentido
 * prestar/recibir plata contra una cuenta vacía o sobregirada). En la edición
 * se usan TODAS (`fetchCuentas`) para que la cuenta del préstamo no desaparezca
 * del select si quedó en 0. El saldo es numeric en Postgres → llega string.
 */
export async function fetchCuentasConSaldo() {
  const rows = await getAllCuentas();
  return rows
    .filter((r) => Number(r.saldo ?? 0) > 0)
    .map((r) => ({ value: r.nombre, label: r.nombre }));
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

// Para Movimientos Tarjeta (opciones de movimiento, solo lectura de ejemplo)
export async function fetchMovimientosTarjetaOptions() {
  const rows = await getAllMovimientosTarjeta();
  return rows.map((r) => ({ value: r.id, label: r.detalle ?? r.id }));
}
