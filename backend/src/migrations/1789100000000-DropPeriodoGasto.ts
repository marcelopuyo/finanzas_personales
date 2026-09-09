import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Elimina la entidad "período de gasto" (2026-09-09):
 * - tabla `periodo_gasto` (con su FK a usuario, CASCADE)
 * - columna `gasto.periodoId` + su FK (ON DELETE NO ACTION, nullable)
 *
 * La única tabla que referenciaba `periodo_gasto` era `gasto`. No hay RLS
 * adicionales que limpiar en este esquema.
 *
 * Rollback (down): recrea la tabla vacía, la FK de usuario y la columna/FK en
 * gasto. NO recupera datos: los períodos eliminados se pierden (backup previo
 * recomendado vía pg_dump).
 */
export class DropPeriodoGasto1789100000000 implements MigrationInterface {
  name = "DropPeriodoGasto1789100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "gasto" DROP CONSTRAINT IF EXISTS "FK_5b76348ff10bcb39da77a41042f"`
    );
    await queryRunner.query(`ALTER TABLE "gasto" DROP COLUMN "periodoId"`);
    await queryRunner.query(`DROP TABLE "periodo_gasto"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "periodo_gasto" ("id" SERIAL NOT NULL, "nombre" character varying NOT NULL, "fechaApertura" date NOT NULL, "fechaCierre" date NOT NULL, "eliminado" boolean NOT NULL DEFAULT false, "usuarioId" integer NOT NULL, CONSTRAINT "PK_d0e58fbaababfd9843dfce9ed67" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "periodo_gasto" ADD CONSTRAINT "FK_31d09b425975b75f5433fc28d8e" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(`ALTER TABLE "gasto" ADD "periodoId" integer`);
    await queryRunner.query(
      `ALTER TABLE "gasto" ADD CONSTRAINT "FK_5b76348ff10bcb39da77a41042f" FOREIGN KEY ("periodoId") REFERENCES "periodo_gasto"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }
}
