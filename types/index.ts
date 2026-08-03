// ============================================================
// Enums
// ============================================================

export enum CategoriaConcepto {
  Ingreso = "Ingreso",
  Egreso = "Egreso",
}

export enum MotivoMovimiento {
  CompraDolares = "Compra Dolares",
  VentaDolares = "Venta Dolares",
  Extraccion = "Extraccion",
  Deposito = "Deposito",
  Transferencia = "Transferencia",
}

// ============================================================
// Response DTOs
// ============================================================

export interface ResponseConceptoDto {
  id: number;
  nombre: string;
  categoria: string;
}

export interface ResponseCategoriaGastoDto {
  id: number;
  nombre: string;
}

export interface ResponseTipoCuentaDto {
  id: number;
  nombre: string;
}

export interface ResponseCuentaDto {
  id: string;
  nombre: string;
  saldo: number;
  tipo: string;
  tarjeta: string;
  moneda: string;
}

export interface ResponseMonedaDto {
  id: string;
  simbolo: string;
  nombre: string;
}

export interface ResponseCotizacionDto {
  id: string;
  fechaInicial: Date;
  fechaFinal: Date;
  cotizacion: number;
  moneda: string;
}

export interface ResponsePersonaDto {
  id: number;
  nombre: string;
  telefono: string;
  mail: string;
}

export interface ResponseInflacionDto {
  id: string;
  fechaInicial: Date;
  fechaFinal: Date;
  indice: number;
}

export interface ResponsePeriodoGastoDto {
  id: number;
  nombre: string;
  fechaApertura: Date;
  fechaCierre: Date;
}

export interface ResponseGastoDto {
  id: string;
  descripcion: string;
  monto: number;
  saldo: number;
  fechaVencimiento: Date;
  fechaPago: Date;
  nombreCategoria: string;
  nombrePeriodo: string;
}

export interface ResponseTarjetaDto {
  id: number;
  nombre: string;
  banco: string;
  numero: string;
  cuenta: string;
}

export interface ResponsePeriodoTarjetaDto {
  id: number;
  nombre: string;
  fechaApertura: Date;
  fechaCierre: Date;
  fechaVencimiento: Date;
  tarjeta: string;
}

export interface ResponseMovimientoTarjetaDto {
  id: number;
  detalle: string;
  fecha: Date;
  monto: number;
  cuotas: number;
  persona: string;
  tarjeta: string;
  periodo: string;
}

export interface ResponsePrestamoDto {
  id: string;
  detalle: string;
  fecha: Date;
  monto: number;
  saldo: number;
  cuotas: number;
  sentido: string;
  personaOrigen: string;
  personaDestino: string;
  cuenta: string;
}

export interface ResponseTrabajoDto {
  id: number;
  nombre: string;
  fechaInicio: Date;
  precioHora: number;
  memos?: string;
}

export interface ResponsePeriodoTrabajoDto {
  id: number;
  fechaDesde: Date;
  fechaHasta: Date;
  montoACobrar: number;
  fechaEstimadaCobro: Date;
  fechaDeCobro: Date;
  trabajo?: { nombre: string };
  jornadas?: ResponseJornadaTrabajoDto[];
}

export interface ResponseJornadaTrabajoDto {
  fechaJornada: Date;
  horaDesde: number;
  horaHasta: number;
  montoJornada: number;
  montoPropina: number;
}

// ============================================================
// Request DTOs
// ============================================================

export interface CreateMovimiento1Dto {
  fecha: Date;
  monto: number;
  idCuenta: number;
  idPeriodoTrabajo?: number;
  idPrestamo?: number;
}

export interface CreateMovimiento2Dto {
  fecha: Date;
  monto: number;
  idCuenta: number;
  idCategoriaGasto: number;
  idGasto: number;
}

export interface CreateMovimiento3Dto {
  fecha: Date;
  montoOrigen: number;
  montoDestino: number;
  idCuentaOrigen: number;
  idCuentaDestino: number;
  motivo: string;
}

// ============================================================
// Reportes / Dashboard types
// ============================================================

export interface CuentaConEvolucion {
  nombreCuenta: string;
  saldoCuenta: number;
  serieEjeX: string[];
  valoresEjeX: number[];
}

export interface GastoPeriodo {
  id?: string;
  descripcion?: string;
  monto: number;
  saldo: number;
  fechaPago?: string | Date;
  fechaVencimiento?: string | Date;
  isPeriodico?: boolean;
  periodo?: { nombre: string };
  categoria?: { nombre: string };
  cuenta?: { nombre: string };
}

export interface PrestamoPendiente {
  personaDestino: { nombre: string };
  monto: number;
  saldo: number;
}

export interface EvolucionItem {
  id: string;
  periodo: string;
  monto?: number;
  valor?: number;
}

export interface JornadaPlane {
  trabajo: string;
  montoJornada: number;
  montoPropina: number;
}

// ============================================================
// Generic API types
// ============================================================

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface ApiError {
  message: string;
  statusCode: number;
}
