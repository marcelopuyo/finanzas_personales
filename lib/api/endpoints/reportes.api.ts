import { apiClient } from "../client";
import type { CuentaConEvolucion, GastoPeriodo, PrestamoPendiente, EvolucionItem } from "@/types";

const SEGMENT = "/reportes";

export async function getBalanceActual() {
  return apiClient.get<number>(`${SEGMENT}/getBalanceActual`);
}

export async function getCuentasConEvolucion() {
  return apiClient.get<CuentaConEvolucion[]>(`${SEGMENT}/getCuentasConEvolucion`);
}

export async function getGastosPeriodo() {
  return apiClient.get<GastoPeriodo[]>(`${SEGMENT}/getGastosPeriodo`);
}

export async function getPrestmosPendientes() {
  return apiClient.get<PrestamoPendiente[]>(`${SEGMENT}/getPrestmosPendientes`);
}

export async function getEvolucionGastos() {
  return apiClient.get<EvolucionItem[]>(`${SEGMENT}/getEvolucionGastos`);
}

export async function getEvolucionIngresos() {
  return apiClient.get<EvolucionItem[]>(`${SEGMENT}/getEvolucionIngresos`);
}

export async function getEvolucionResultados() {
  return apiClient.get<EvolucionItem[]>(`${SEGMENT}/getEvolucionResultados`);
}
