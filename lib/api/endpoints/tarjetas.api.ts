import { apiClient } from "../client";
import type { ResponseTarjetaDto, ResponsePeriodoTarjetaDto, ResponseMovimientoTarjetaDto } from "@/types";

const SEGMENT = "/tarjetas";

// ---- Tarjeta ----
export async function getAllTarjetas() {
  return apiClient.get<ResponseTarjetaDto[]>(`${SEGMENT}/tarjeta`);
}

export async function getTarjetaById(id: number) {
  return apiClient.get<ResponseTarjetaDto>(`${SEGMENT}/tarjeta/${id}`);
}

export async function createTarjeta(data: { nombre: string; banco?: string; numero?: string; cuenta?: string }) {
  return apiClient.post(`${SEGMENT}/tarjeta`, data);
}

export async function updateTarjeta(id: number, data: Partial<{ nombre: string; banco: string; numero: string; cuenta: string }>) {
  return apiClient.patch(`${SEGMENT}/tarjeta/${id}`, data);
}

export async function deleteTarjeta(id: number) {
  return apiClient.delete(`${SEGMENT}/tarjeta/${id}`);
}

// ---- Periodo Tarjeta ----
export async function getAllPeriodosTarjeta() {
  return apiClient.get<ResponsePeriodoTarjetaDto[]>(`${SEGMENT}/periodo-tarjeta`);
}

export async function getPeriodoTarjetaById(id: number) {
  return apiClient.get<ResponsePeriodoTarjetaDto>(`${SEGMENT}/periodo-tarjeta/${id}`);
}

export async function createPeriodoTarjeta(data: {
  nombre: string;
  fechaApertura: Date;
  fechaCierre: Date;
  fechaVencimiento: Date;
  tarjeta: string;
}) {
  return apiClient.post(`${SEGMENT}/periodo-tarjeta`, data);
}

export async function updatePeriodoTarjeta(
  id: number,
  data: Partial<{
    nombre: string;
    fechaApertura: Date;
    fechaCierre: Date;
    fechaVencimiento: Date;
    tarjeta: string;
  }>
) {
  return apiClient.patch(`${SEGMENT}/periodo-tarjeta/${id}`, data);
}

export async function deletePeriodoTarjeta(id: number) {
  return apiClient.delete(`${SEGMENT}/periodo-tarjeta/${id}`);
}

// ---- Movimiento Tarjeta ----
export async function getAllMovimientosTarjeta() {
  return apiClient.get<ResponseMovimientoTarjetaDto[]>(`${SEGMENT}/movimiento-tarjeta`);
}

export async function getMovimientoTarjetaById(id: number) {
  return apiClient.get<ResponseMovimientoTarjetaDto>(`${SEGMENT}/movimiento-tarjeta/${id}`);
}

export async function createMovimientoTarjeta(data: {
  detalle: string;
  fecha: Date;
  monto: number;
  cuotas: number;
  persona: string;
  tarjeta: string;
  periodo: string;
}) {
  return apiClient.post(`${SEGMENT}/movimiento-tarjeta`, data);
}

export async function updateMovimientoTarjeta(
  id: number,
  data: Partial<{
    detalle: string;
    fecha: Date;
    monto: number;
    cuotas: number;
    persona: string;
    tarjeta: string;
    periodo: string;
  }>
) {
  return apiClient.patch(`${SEGMENT}/movimiento-tarjeta/${id}`, data);
}

export async function deleteMovimientoTarjeta(id: number) {
  return apiClient.delete(`${SEGMENT}/movimiento-tarjeta/${id}`);
}
