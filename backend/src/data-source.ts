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
import { Usuario } from "./entities/usuario.entity";

// ============================================================
// DataSource de MIGRACIONES (apunta a PostgreSQL 18 / puerto 5432).
// NO se usa en runtime (la app sigue en SQL Server con db.ts).
// Solo lo consume el CLI de TypeORM:
//   npm run migration:run | migration:revert | migration:show
//   npm run migration:generate -- backend/src/migrations/<Nombre>
// ============================================================

export const ENTITIES = [
  Concepto, Persona, Moneda, TipoCuenta, Cuenta, Cotizacion,
  HistoricoCuenta, Inflacion, CategoriaGasto, PeriodoGasto, Gasto,
  Tarjeta, PeriodoTarjeta, MovimientoTarjeta,
  Trabajo, PeriodoTrabajo, JornadaTrabajo, Prestamo, Movimiento,
  Usuario,
];

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.PG_HOST ?? "localhost",
  port: Number(process.env.PG_PORT ?? 5432),
  username: process.env.PG_USERNAME ?? "postgres",
  password: process.env.PG_PASSWORD ?? "",
  database: process.env.PG_DATABASE ?? "",
  synchronize: false,
  logging: ["error", "warn"],
  entities: ENTITIES,
  migrations: ["backend/src/migrations/**/*.ts"],
  migrationsTableName: "migrations",
});
