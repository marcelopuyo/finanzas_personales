import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Agrega el orden manual de las cuentas (`cuenta.orden`, int NOT NULL 0),
 * por USUARIO. Backfill: renumerar cada usuario según su orden actual
 * (`id ASC` → 0,1,2…), incluye también cuentas eliminadas para dejar el
 * campo poblado (el orden solo aplica a las activas en las consultas).
 *
 * Rollback (down): quita la columna (el backfill no se revierte por fila).
 */
export class AddOrdenCuenta1789500000000 implements MigrationInterface {
  name = "AddOrdenCuenta1789500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cuenta" ADD "orden" integer NOT NULL DEFAULT 0`
    );
    await queryRunner.query(
      `WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY "usuarioId" ORDER BY id ASC) - 1 AS r
          FROM "cuenta"
        )
        UPDATE "cuenta" c SET "orden" = ranked.r FROM ranked WHERE c.id = ranked.id`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cuenta" DROP COLUMN "orden"`);
  }
}
