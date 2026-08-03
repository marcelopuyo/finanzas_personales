import "reflect-metadata";
import { DataSource } from "typeorm";
import { Concepto } from "./entities/concepto.entity";
import { Persona } from "./entities/persona.entity";
import { Moneda } from "./entities/moneda.entity";
import { TipoCuenta } from "./entities/tipo-cuenta.entity";
import { Cuenta } from "./entities/cuenta.entity";
import { Cotizacion } from "./entities/cotizacion.entity";
import { HistoricoCuenta } from "./entities/historico-cuenta.entity";
import { Inflacion } from "./entities/inflacion.entity";
import { CategoriaGasto } from "./entities/categoria-gasto.entity";
import { PeriodoGasto } from "./entities/periodo-gasto.entity";
import { Gasto } from "./entities/gasto.entity";
import { Tarjeta } from "./entities/tarjeta.entity";
import { PeriodoTarjeta } from "./entities/periodo-tarjeta.entity";
import { MovimientoTarjeta } from "./entities/movimiento-tarjeta.entity";
import { Trabajo } from "./entities/trabajo.entity";
import { PeriodoTrabajo } from "./entities/periodo-trabajo.entity";
import { JornadaTrabajo } from "./entities/jornada-trabajo.entity";
import { Prestamo } from "./entities/prestamo.entity";

// Singleton global para evitar reconexiones duplicadas durante HMR en desarrollo
const globalForDb = globalThis as unknown as {
  dataSource?: DataSource;
};

export const AppDataSource =
  globalForDb.dataSource ??
  new DataSource({
    type: "mssql",
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    // El esquema ya existe en la BD (creado por el backend NestJS).
    // Nunca sincronizar aquí para no alterar la base de datos.
    synchronize: false,
    logging: ["error", "warn"],
    options: {
      trustServerCertificate: true,
    },
    // Entidades registradas por módulo migrado.
    // Fase 2: Maestros (8) · Fase 3: Gastos (3) · Fases 4-6: Tarjetas/Trabajos/Préstamos (7)
    entities: [
      Concepto,
      Persona,
      Moneda,
      TipoCuenta,
      Cuenta,
      Cotizacion,
      HistoricoCuenta,
      Inflacion,
      CategoriaGasto,
      PeriodoGasto,
      Gasto,
      Tarjeta,
      PeriodoTarjeta,
      MovimientoTarjeta,
      Trabajo,
      PeriodoTrabajo,
      JornadaTrabajo,
      Prestamo,
    ],
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.dataSource = AppDataSource;
}

/** Devuelve el DataSource inicializado (idempotente). */
export async function getDb(): Promise<DataSource> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  return AppDataSource;
}
