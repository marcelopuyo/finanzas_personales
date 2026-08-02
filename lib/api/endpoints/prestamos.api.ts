import { apiClient } from "../client";
import type { ResponsePrestamoDto } from "@/types";

const SEGMENT = "/prestamos";

export async function getAllPrestamos() {
  return apiClient.get<ResponsePrestamoDto[]>(`${SEGMENT}`);
}

export async function getPrestamoById(id: number) {
  return apiClient.get<ResponsePrestamoDto>(`${SEGMENT}/${id}`);
}

export async function createPrestamo(data: {
  detalle: string;
  fecha: Date;
  monto: number;
  saldo?: number;
  cuotas: number;
  sentido: string;
  personaOrigen: string;
  personaDestino: string;
  cuenta: string;
}) {
  return apiClient.post(`${SEGMENT}`, data);
}

export async function updatePrestamo(
  id: number,
  data: Partial<{
    detalle: string;
    fecha: Date;
    monto: number;
    saldo: number;
    cuotas: number;
    sentido: string;
    personaOrigen: string;
    personaDestino: string;
    cuenta: string;
  }>
) {
  return apiClient.patch(`${SEGMENT}/${id}`, data);
}

export async function deletePrestamo(id: number) {
  return apiClient.delete(`${SEGMENT}/${id}`);
}
