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
import { Movimiento } from "./entities/movimiento.entity";

// Singleton global para evitar reconexiones duplicadas durante HMR
const globalForDb = globalThis as unknown as {
  dataSource?: DataSource;
};

/** Devuelve el DataSource inicializado (idempotente). */
export async function getDb(): Promise<DataSource> {
  const ds = globalForDb.dataSource;

  if (ds?.isInitialized) {
    // En desarrollo (HMR), las clases de entidad pueden haber sido reemplazadas
    // por nuevas instancias de módulo. Si no encuentra metadata, reinicializa.
    try {
      ds.getMetadata(Concepto);
      return ds;
    } catch {
      await ds.destroy();
      delete globalForDb.dataSource;
    }
  }

  if (!globalForDb.dataSource) {
    globalForDb.dataSource = new DataSource({
      type: "mssql",
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      synchronize: false,
      logging: ["error", "warn"],
      options: { trustServerCertificate: true },
      entities: [
        Concepto, Persona, Moneda, TipoCuenta, Cuenta, Cotizacion,
        HistoricoCuenta, Inflacion, CategoriaGasto, PeriodoGasto, Gasto,
        Tarjeta, PeriodoTarjeta, MovimientoTarjeta,
        Trabajo, PeriodoTrabajo, JornadaTrabajo, Prestamo, Movimiento,
      ],
    });
  }

  await globalForDb.dataSource.initialize();
  return globalForDb.dataSource;
}
