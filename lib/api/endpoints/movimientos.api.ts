import { apiClient } from "../client";
import type { CreateMovimiento1Dto, CreateMovimiento2Dto, CreateMovimiento3Dto } from "@/types";

const SEGMENT = "/movimientos";

export async function cobroSueldo(data: CreateMovimiento1Dto) {
  return apiClient.post(`${SEGMENT}/CobroSueldo`, data);
}

export async function pagoPrestamo(data: CreateMovimiento1Dto) {
  return apiClient.post(`${SEGMENT}/PagoPrestamo`, data);
}

export async function ajusteCuenta(data: CreateMovimiento1Dto) {
  return apiClient.post(`${SEGMENT}/AjusteCuenta`, data);
}

export async function pagoGasto(data: CreateMovimiento2Dto) {
  return apiClient.post(`${SEGMENT}/PagoGasto`, data);
}

export async function gastoDirecto(data: CreateMovimiento2Dto) {
  return apiClient.post(`${SEGMENT}/GastoDirecto`, data);
}

export async function transferencia(data: CreateMovimiento3Dto) {
  return apiClient.post(`${SEGMENT}/Transferencia`, data);
}

export async function getMovimientosBetweenDates(fechaDesde: string, fechaHasta: string) {
  return apiClient.get(`${SEGMENT}/between-dates`, {
    fechaDesde,
    fechaHasta,
  });
}
