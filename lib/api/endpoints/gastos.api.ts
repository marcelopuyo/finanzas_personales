import { apiClient } from "../client";
import type { ResponseGastoDto, ResponsePeriodoGastoDto } from "@/types";

const SEGMENT = "/gastos";

// ---- Periodo Gasto ----
export async function getAllPeriodosGasto() {
  return apiClient.get<ResponsePeriodoGastoDto[]>(`${SEGMENT}/periodo-gasto`);
}

export async function getPeriodoGastoById(id: number) {
  return apiClient.get<ResponsePeriodoGastoDto>(`${SEGMENT}/periodo-gasto/${id}`);
}

export async function createPeriodoGasto(data: { nombre: string; fechaApertura: Date; fechaCierre: Date }) {
  return apiClient.post(`${SEGMENT}/periodo-gasto`, data);
}

export async function updatePeriodoGasto(id: number, data: Partial<{ nombre: string; fechaApertura: Date; fechaCierre: Date }>) {
  return apiClient.patch(`${SEGMENT}/periodo-gasto/${id}`, data);
}

export async function deletePeriodoGasto(id: number) {
  return apiClient.delete(`${SEGMENT}/periodo-gasto/${id}`);
}

// ---- Gasto ----
export async function getAllGastos() {
  return apiClient.get<ResponseGastoDto[]>(`${SEGMENT}/gasto`);
}

export async function getGastoById(id: number) {
  return apiClient.get<ResponseGastoDto>(`${SEGMENT}/gasto/${id}`);
}

export async function createGasto(data: {
  descripcion: string;
  monto: number;
  saldo?: number;
  fechaVencimiento: Date;
  nombreCategoria: string;
  nombrePeriodo: string;
}) {
  return apiClient.post(`${SEGMENT}/gasto`, data);
}

export async function updateGasto(
  id: number,
  data: Partial<{
    descripcion: string;
    monto: number;
    saldo: number;
    fechaVencimiento: Date;
    fechaPago: Date;
    nombreCategoria: string;
    nombrePeriodo: string;
  }>
) {
  return apiClient.patch(`${SEGMENT}/gasto/${id}`, data);
}

export async function deleteGasto(id: number) {
  return apiClient.delete(`${SEGMENT}/gasto/${id}`);
}
