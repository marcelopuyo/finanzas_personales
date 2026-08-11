import { getDb } from "../db";
import { requireAdmin, requireUserId } from "../lib/auth";
import { Concepto } from "../entities/concepto.entity";
import { Cotizacion } from "../entities/cotizacion.entity";
import { Cuenta } from "../entities/cuenta.entity";
import { HistoricoCuenta } from "../entities/historico-cuenta.entity";
import { Inflacion } from "../entities/inflacion.entity";
import { Moneda } from "../entities/moneda.entity";
import { Persona } from "../entities/persona.entity";
import { TipoCuenta } from "../entities/tipo-cuenta.entity";

// ============================================================
// Tipos de salida (coinciden con los Response DTOs del backend)
// ============================================================
export interface ConceptoOut {
  id: number;
  nombre: string;
  categoria: string | null;
}

export interface TipoCuentaOut {
  id: number;
  nombre: string;
}

export interface MonedaOut {
  id: number;
  simbolo: string;
  nombre: string;
  codigoISO: string;
}

export interface PersonaOut {
  id: number;
  nombre: string;
  telefono: string | null;
  mail: string | null;
}

export interface CuentaOut {
  id: number;
  nombre: string;
  saldo: number;
  tipo: { nombre: string } | null;
  tarjeta: null;
  moneda: { nombre: string; codigoISO: string } | null;
}

export interface CotizacionOut {
  id: number;
  fechaInicial: Date;
  fechaFinal: Date | null;
  cotizacion: number;
  monedaOrigen: { nombre: string; codigoISO: string } | null;
  monedaDestino: { nombre: string; codigoISO: string } | null;
}

export interface InflacionOut {
  id: number;
  fechaInicial: Date;
  fechaFinal: Date;
  indice: number;
}

export interface HistoricoCuentaOut {
  fechaDesde: Date;
  fechaHasta: Date | null;
  saldo: number;
  cuenta: { nombre: string } | null;
}

// ============================================================
// Conceptos
// ============================================================
// Tabla GLOBAL/compartida (NO multiusuario): todos los usuarios ven los mismos
// conceptos no eliminados. El CRUD (crear/editar/eliminar) está restringido a
// administradores en las acciones y en las páginas.
export async function getAllConceptos(): Promise<ConceptoOut[]> {
  const ds = await getDb();
  const rows = await ds.getRepository(Concepto).find({
    where: { eliminado: false },
  });
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    categoria: r.categoria ?? null,
  }));
}

export async function getConceptoById(
  id: number
): Promise<ConceptoOut | null> {
  const ds = await getDb();
  const r = await ds.getRepository(Concepto).findOne({
    where: { id, eliminado: false },
  });
  return r
    ? { id: r.id, nombre: r.nombre, categoria: r.categoria ?? null }
    : null;
}

// ============================================================
// Tipos de Cuenta
// ============================================================
export async function getAllTiposCuenta(): Promise<TipoCuentaOut[]> {
  const ds = await getDb();
  const rows = await ds
    .getRepository(TipoCuenta)
    .find({ where: { eliminado: false } });
  return rows.map((r) => ({ id: r.id, nombre: r.nombre }));
}

export async function getTipoCuentaById(
  id: number
): Promise<TipoCuentaOut | null> {
  const ds = await getDb();
  const r = await ds
    .getRepository(TipoCuenta)
    .findOne({ where: { id, eliminado: false } });
  return r ? { id: r.id, nombre: r.nombre } : null;
}

// ============================================================
// Monedas
// ============================================================
export async function getAllMonedas(): Promise<MonedaOut[]> {
  const ds = await getDb();
  const rows = await ds
    .getRepository(Moneda)
    .find({ where: { eliminado: false } });
  return rows.map((r) => ({ id: r.id, simbolo: r.simbolo, nombre: r.nombre, codigoISO: r.codigoISO }));
}

export async function getMonedaById(id: number): Promise<MonedaOut | null> {
  const ds = await getDb();
  const r = await ds
    .getRepository(Moneda)
    .findOne({ where: { id, eliminado: false } });
  return r ? { id: r.id, simbolo: r.simbolo, nombre: r.nombre, codigoISO: r.codigoISO } : null;
}

// ============================================================
// Personas
// ============================================================
export async function getAllPersonas(): Promise<PersonaOut[]> {
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds
    .getRepository(Persona)
    .find({ where: { usuario: { id: userId }, eliminado: false } });
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    telefono: r.telefono ?? null,
    mail: r.mail ?? null,
  }));
}

export async function getPersonaById(id: number): Promise<PersonaOut | null> {
  const userId = await requireUserId();
  const ds = await getDb();
  const r = await ds.getRepository(Persona).findOne({
    where: { id, usuario: { id: userId }, eliminado: false },
  });
  return r
    ? {
        id: r.id,
        nombre: r.nombre,
        telefono: r.telefono ?? null,
        mail: r.mail ?? null,
      }
    : null;
}

// ============================================================
// Cuentas (relaciones tipo y moneda)
// ============================================================
export async function getAllCuentas(): Promise<CuentaOut[]> {
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds.getRepository(Cuenta).find({
    where: { usuario: { id: userId }, eliminado: false },
    relations: { tipo: true, moneda: true },
  });
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    saldo: r.saldo,
    tipo: r.tipo ? { nombre: r.tipo.nombre } : null,
    tarjeta: null,
    moneda: r.moneda
      ? { nombre: r.moneda.nombre, codigoISO: r.moneda.codigoISO }
      : null,
  }));
}

export async function getCuentaById(id: number): Promise<CuentaOut | null> {
  const userId = await requireUserId();
  const ds = await getDb();
  const r = await ds.getRepository(Cuenta).findOne({
    where: { id, usuario: { id: userId }, eliminado: false },
    relations: { tipo: true, moneda: true },
  });
  return r
    ? {
        id: r.id,
        nombre: r.nombre,
        saldo: r.saldo,
        tipo: r.tipo ? { nombre: r.tipo.nombre } : null,
        tarjeta: null,
        moneda: r.moneda
          ? { nombre: r.moneda.nombre, codigoISO: r.moneda.codigoISO }
          : null,
      }
    : null;
}

// ============================================================
// Cotizaciones (relación moneda)
// ============================================================
// Cotizaciones (GLOBALES — solo admin; sin entrada manual)
// ============================================================
export async function getAllCotizaciones(): Promise<CotizacionOut[]> {
  await requireAdmin();
  const ds = await getDb();
  const rows = await ds.getRepository(Cotizacion).find({
    where: { eliminado: false },
    relations: { monedaOrigen: true, monedaDestino: true },
    order: { fechaInicial: "DESC", id: "DESC" },
  });
  return rows.map((r) => ({
    id: r.id,
    fechaInicial: r.fechaInicial,
    fechaFinal: r.fechaFinal ?? null,
    cotizacion: r.cotizacion,
    monedaOrigen: r.monedaOrigen
      ? { nombre: r.monedaOrigen.nombre, codigoISO: r.monedaOrigen.codigoISO }
      : null,
    monedaDestino: r.monedaDestino
      ? { nombre: r.monedaDestino.nombre, codigoISO: r.monedaDestino.codigoISO }
      : null,
  }));
}

// ============================================================
// Inflación
// ============================================================
export async function getAllInflaciones(): Promise<InflacionOut[]> {
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds
    .getRepository(Inflacion)
    .find({ where: { usuario: { id: userId }, eliminado: false } });
  return rows.map((r) => ({
    id: r.id,
    fechaInicial: r.fechaInicial,
    fechaFinal: r.fechaFinal,
    indice: r.indice,
  }));
}

export async function getInflacionById(
  id: number
): Promise<InflacionOut | null> {
  const userId = await requireUserId();
  const ds = await getDb();
  const r = await ds
    .getRepository(Inflacion)
    .findOne({ where: { id, usuario: { id: userId }, eliminado: false } });
  return r
    ? {
        id: r.id,
        fechaInicial: r.fechaInicial,
        fechaFinal: r.fechaFinal,
        indice: r.indice,
      }
    : null;
}

// ============================================================
// Histórico de cuentas (solo lectura)
// ============================================================
export async function getAllHistoricosCuenta(): Promise<HistoricoCuentaOut[]> {
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds.getRepository(HistoricoCuenta).find({
    where: { eliminado: false, cuenta: { usuario: { id: userId } } },
    relations: { cuenta: true },
  });
  return rows.map((r) => ({
    fechaDesde: r.fechaDesde,
    fechaHasta: r.fechaHasta ?? null,
    saldo: r.saldo,
    cuenta: r.cuenta ? { nombre: r.cuenta.nombre } : null,
  }));
}

export async function getHistoricosByCuentaId(
  idCuenta: number
): Promise<HistoricoCuentaOut[]> {
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds.getRepository(HistoricoCuenta).find({
    where: { eliminado: false, cuenta: { id: idCuenta, usuario: { id: userId } } },
    relations: { cuenta: true },
  });
  return rows.map((r) => ({
    fechaDesde: r.fechaDesde,
    fechaHasta: r.fechaHasta ?? null,
    saldo: r.saldo,
    cuenta: r.cuenta ? { nombre: r.cuenta.nombre } : null,
  }));
}
