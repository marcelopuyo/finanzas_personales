import { apiClient } from "../client";
import type {
  ResponseConceptoDto,
  ResponseCategoriaGastoDto,
  ResponseTipoCuentaDto,
  ResponseCuentaDto,
  ResponsePersonaDto,
  ResponseMonedaDto,
  ResponseCotizacionDto,
  ResponseInflacionDto,
} from "@/types";

const SEGMENT = "/maestros";

// ---- Concepto ----
export async function getAllConceptos(limit = 10000000, offset = 0) {
  return apiClient.get<ResponseConceptoDto[]>(`${SEGMENT}/concepto`, { limit, offset });
}

export async function getConceptoById(id: number) {
  return apiClient.get<ResponseConceptoDto>(`${SEGMENT}/concepto/${id}`);
}

export async function createConcepto(data: { nombre: string; categoria: string }) {
  return apiClient.post(`${SEGMENT}/concepto`, data);
}

export async function updateConcepto(id: number, data: { nombre?: string; categoria?: string }) {
  return apiClient.patch(`${SEGMENT}/concepto/${id}`, data);
}

export async function deleteConcepto(id: number) {
  return apiClient.delete(`${SEGMENT}/concepto/${id}`);
}

// ---- Categoria Gasto ----
export async function getAllCategoriasGasto() {
  return apiClient.get<ResponseCategoriaGastoDto[]>(`${SEGMENT}/categoria-gasto`);
}

export async function getCategoriaGastoById(id: number) {
  return apiClient.get<ResponseCategoriaGastoDto>(`${SEGMENT}/categoria-gasto/${id}`);
}

export async function createCategoriaGasto(data: { nombre: string }) {
  return apiClient.post(`${SEGMENT}/categoria-gasto`, data);
}

export async function updateCategoriaGasto(id: number, data: { nombre?: string }) {
  return apiClient.patch(`${SEGMENT}/categoria-gasto/${id}`, data);
}

export async function deleteCategoriaGasto(id: number) {
  return apiClient.delete(`${SEGMENT}/categoria-gasto/${id}`);
}

// ---- Tipo Cuenta ----
export async function getAllTiposCuenta() {
  return apiClient.get<ResponseTipoCuentaDto[]>(`${SEGMENT}/tipo-cuenta`);
}

export async function getTipoCuentaById(id: number) {
  return apiClient.get<ResponseTipoCuentaDto>(`${SEGMENT}/tipo-cuenta/${id}`);
}

export async function createTipoCuenta(data: { nombre: string }) {
  return apiClient.post(`${SEGMENT}/tipo-cuenta`, data);
}

export async function updateTipoCuenta(id: number, data: { nombre?: string }) {
  return apiClient.patch(`${SEGMENT}/tipo-cuenta/${id}`, data);
}

export async function deleteTipoCuenta(id: number) {
  return apiClient.delete(`${SEGMENT}/tipo-cuenta/${id}`);
}

// ---- Cuenta ----
export async function getAllCuentas() {
  return apiClient.get<ResponseCuentaDto[]>(`${SEGMENT}/cuenta`);
}

export async function getCuentaById(id: number) {
  return apiClient.get<ResponseCuentaDto>(`${SEGMENT}/cuenta/${id}`);
}

export async function createCuenta(data: { nombre: string; saldo?: number; tipo?: string; moneda?: string }) {
  return apiClient.post(`${SEGMENT}/cuenta`, data);
}

export async function updateCuenta(id: number, data: Partial<{ nombre: string; saldo: number; tipo: string; moneda: string }>) {
  return apiClient.patch(`${SEGMENT}/cuenta/${id}`, data);
}

export async function deleteCuenta(id: number) {
  return apiClient.delete(`${SEGMENT}/cuenta/${id}`);
}

// ---- Persona ----
export async function getAllPersonas() {
  return apiClient.get<ResponsePersonaDto[]>(`${SEGMENT}/persona`);
}

export async function getPersonaById(id: number) {
  return apiClient.get<ResponsePersonaDto>(`${SEGMENT}/persona/${id}`);
}

export async function createPersona(data: { nombre: string; telefono?: string; mail?: string }) {
  return apiClient.post(`${SEGMENT}/persona`, data);
}

export async function updatePersona(id: number, data: Partial<{ nombre: string; telefono: string; mail: string }>) {
  return apiClient.patch(`${SEGMENT}/persona/${id}`, data);
}

export async function deletePersona(id: number) {
  return apiClient.delete(`${SEGMENT}/persona/${id}`);
}

// ---- Moneda ----
export async function getAllMonedas() {
  return apiClient.get<ResponseMonedaDto[]>(`${SEGMENT}/moneda`);
}

export async function getMonedaById(id: number) {
  return apiClient.get<ResponseMonedaDto>(`${SEGMENT}/moneda/${id}`);
}

export async function createMoneda(data: { simbolo: string; nombre: string }) {
  return apiClient.post(`${SEGMENT}/moneda`, data);
}

export async function updateMoneda(id: number, data: Partial<{ simbolo: string; nombre: string }>) {
  return apiClient.patch(`${SEGMENT}/moneda/${id}`, data);
}

export async function deleteMoneda(id: number) {
  return apiClient.delete(`${SEGMENT}/moneda/${id}`);
}

// ---- Cotizacion ----
export async function getAllCotizaciones() {
  return apiClient.get<ResponseCotizacionDto[]>(`${SEGMENT}/cotizacion`);
}

export async function getCotizacionById(id: number) {
  return apiClient.get<ResponseCotizacionDto>(`${SEGMENT}/cotizacion/${id}`);
}

export async function createCotizacion(data: { fechaInicial: Date; fechaFinal: Date; cotizacion: number; moneda: string }) {
  return apiClient.post(`${SEGMENT}/cotizacion`, data);
}

export async function updateCotizacion(id: number, data: Partial<{ fechaInicial: Date; fechaFinal: Date; cotizacion: number; moneda: string }>) {
  return apiClient.patch(`${SEGMENT}/cotizacion/${id}`, data);
}

export async function deleteCotizacion(id: number) {
  return apiClient.delete(`${SEGMENT}/cotizacion/${id}`);
}

// ---- Inflacion ----
export async function getAllInflaciones() {
  return apiClient.get<ResponseInflacionDto[]>(`${SEGMENT}/inflacion`);
}

export async function getInflacionById(id: number) {
  return apiClient.get<ResponseInflacionDto>(`${SEGMENT}/inflacion/${id}`);
}

export async function createInflacion(data: { fechaInicial: Date; fechaFinal: Date; indice: number }) {
  return apiClient.post(`${SEGMENT}/inflacion`, data);
}

export async function updateInflacion(id: number, data: Partial<{ fechaInicial: Date; fechaFinal: Date; indice: number }>) {
  return apiClient.patch(`${SEGMENT}/inflacion/${id}`, data);
}

export async function deleteInflacion(id: number) {
  return apiClient.delete(`${SEGMENT}/inflacion/${id}`);
}
