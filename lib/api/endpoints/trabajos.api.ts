import { apiClient } from "../client";
import type {
  ResponseTrabajoDto,
  ResponsePeriodoTrabajoDto,
  ResponseJornadaTrabajoDto,
  JornadaPlane,
} from "@/types";

const SEGMENT = "/trabajos";

// ---- Trabajo ----
export async function getAllTrabajos() {
  return apiClient.get<ResponseTrabajoDto[]>(`${SEGMENT}/trabajo`);
}

export async function getTrabajoById(id: number) {
  return apiClient.get<ResponseTrabajoDto>(`${SEGMENT}/trabajo/${id}`);
}

export async function createTrabajo(data: { nombre: string; fechaInicio: Date; precioHora: number; memos?: string }) {
  return apiClient.post(`${SEGMENT}/trabajo`, data);
}

export async function updateTrabajo(
  id: number,
  data: Partial<{ nombre: string; fechaInicio: Date; precioHora: number; memos: string }>
) {
  return apiClient.patch(`${SEGMENT}/trabajo/${id}`, data);
}

export async function deleteTrabajo(id: number) {
  return apiClient.delete(`${SEGMENT}/trabajo/${id}`);
}

// ---- Periodo Trabajo ----
export async function getAllPeriodosTrabajo() {
  return apiClient.get<ResponsePeriodoTrabajoDto[]>(`${SEGMENT}/periodo-trabajo`);
}

export async function getPeriodoTrabajoById(id: number) {
  return apiClient.get<ResponsePeriodoTrabajoDto>(`${SEGMENT}/periodo-trabajo/${id}`);
}

export async function createPeriodoTrabajo(data: {
  fechaDesde: Date;
  fechaHasta: Date;
  montoACobrar: number;
  fechaEstimadaCobro: Date;
  fechaDeCobro?: Date;
  nombreTrabajo: string;
}) {
  return apiClient.post(`${SEGMENT}/periodo-trabajo`, data);
}

export async function updatePeriodoTrabajo(
  id: number,
  data: Partial<{
    fechaDesde: Date;
    fechaHasta: Date;
    montoACobrar: number;
    fechaEstimadaCobro: Date;
    fechaDeCobro: Date;
    nombreTrabajo: string;
  }>
) {
  return apiClient.patch(`${SEGMENT}/periodo-trabajo/${id}`, data);
}

export async function deletePeriodoTrabajo(id: number) {
  return apiClient.delete(`${SEGMENT}/periodo-trabajo/${id}`);
}

// ---- Jornada Trabajo ----
export async function getAllJornadasTrabajo() {
  return apiClient.get<ResponseJornadaTrabajoDto[]>(`${SEGMENT}/jornada-trabajo`);
}

export async function getAllJornadasTrabajoPlane() {
  return apiClient.get<JornadaPlane[]>(`${SEGMENT}/jornada-trabajo/plane`);
}

export async function getJornadaTrabajoById(id: number) {
  return apiClient.get<ResponseJornadaTrabajoDto>(`${SEGMENT}/jornada-trabajo/${id}`);
}

export async function createJornadaTrabajo(data: {
  fechaJornada: Date;
  horaDesde: number;
  horaHasta: number;
  montoJornada: number;
  montoPropina: number;
  idPeriodoTrabajo: number;
}) {
  return apiClient.post(`${SEGMENT}/jornada-trabajo`, data);
}

export async function updateJornadaTrabajo(
  id: number,
  data: Partial<{
    fechaJornada: Date;
    horaDesde: number;
    horaHasta: number;
    montoJornada: number;
    montoPropina: number;
  }>
) {
  return apiClient.patch(`${SEGMENT}/jornada-trabajo/${id}`, data);
}

export async function deleteJornadaTrabajo(id: number) {
  return apiClient.delete(`${SEGMENT}/jornada-trabajo/${id}`);
}
