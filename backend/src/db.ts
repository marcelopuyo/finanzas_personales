import "reflect-metadata";
import { DataSource } from "typeorm";
import pg from "pg";
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
import { Usuario } from "./entities/usuario.entity";
import { pgSslOption } from "./lib/pg-ssl";

// Singleton global para evitar reconexiones duplicadas durante HMR
const globalForDb = globalThis as unknown as {
  dataSource?: DataSource;
  initPromise?: Promise<DataSource>;
};

// Todas las entidades registradas (se usan para verificar metadatos y crear el DS)
const ENTITIES = [
  Concepto, Persona, Moneda, TipoCuenta, Cuenta, Cotizacion,
  HistoricoCuenta, Inflacion, CategoriaGasto, PeriodoGasto, Gasto,
  Tarjeta, PeriodoTarjeta, MovimientoTarjeta,
  Trabajo, PeriodoTrabajo, JornadaTrabajo, Prestamo, Movimiento,
  Usuario,
];

// El driver `pg` devuelve `numeric` (OID 1700) como string. Como los montos y
// saldos son dinero (numeric(10,2)), se parsean a número para que TypeORM
// hidrate las propiedades `number` (las sumas del backend necesitan números).
pg.types.setTypeParser(1700, (v: string) => parseFloat(v));

/** Crea un DataSource de PostgreSQL con las credenciales de `.env.local` (PG_*). */
function createDataSource(): DataSource {
  return new DataSource({
    type: "postgres",
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT),
    username: process.env.PG_USERNAME,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    // SSL condicional: requerido por proveedores cloud (Supabase/Neon) vía PG_SSL=true.
    ssl: pgSslOption(),
    synchronize: false,
    logging: ["error", "warn"],
    entities: ENTITIES,
  });
}

/** Devuelve el DataSource inicializado (idempotente y seguro ante concurrencia). */
export async function getDb(): Promise<DataSource> {
  const ds = globalForDb.dataSource;

  if (ds?.isInitialized) {
    // En desarrollo (HMR), las clases de entidad pueden haber sido reemplazadas
    // por nuevas instancias de módulo (a veces solo algunas). Si falta metadata
    // de CUALQUIER entidad, reinicializa el DataSource.
    try {
      for (const entity of ENTITIES) ds.getMetadata(entity);
      return ds;
    } catch {
      // destroy() puede fallar si la metadata quedó en un estado inconsistente;
      // igualmente descartamos el DataSource para forzar recrearlo.
      try {
        await ds.destroy();
      } catch {
        /* ignorar */
      }
      delete globalForDb.dataSource;
      delete globalForDb.initPromise;
    }
  }

  if (!globalForDb.dataSource) {
    globalForDb.dataSource = createDataSource();
  }

  // Cachea la promesa de inicialización: varias consultas concurrentes
  // (ej. las 9 del dashboard) comparten UNA misma inicialización en vez de
  // competir entre sí (evita "Connection terminated" durante el arranque).
  if (!globalForDb.initPromise) {
    globalForDb.initPromise = globalForDb.dataSource.initialize().catch(
      async (err: unknown) => {
        // Si la inicialización falla (p.ej. metadata rota por HMR), reintentar
        // una vez con un DataSource nuevo antes de propagar el error.
        console.error(
          "[db] initialize falló, reintentando con un DataSource nuevo:",
          (err as Error).message
        );
        try {
          await globalForDb.dataSource?.destroy();
        } catch {
          /* ignorar */
        }
        delete globalForDb.dataSource;
        delete globalForDb.initPromise;
        globalForDb.dataSource = createDataSource();
        return globalForDb.dataSource.initialize();
      }
    );
  }

  try {
    return await globalForDb.initPromise;
  } catch (err) {
    delete globalForDb.initPromise;
    throw err;
  }
}
