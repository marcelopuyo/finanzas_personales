import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * **`motivo` en `movimiento`** — transferencias con motivo personalizado.
 *
 * El "motivo" de una transferencia era un enum de 5 valores que sólo elegía el par
 * de CONCEPTOS (`Transferencia Ingreso/Egreso`, `Compra Dolares …`): nunca se
 * guardaba como texto. Para permitir un motivo escrito a mano hace falta persistirlo.
 *
 * 1. `movimiento.motivo` varchar(60) **nullable**.
 * 2. **Sin backfill**: las filas históricas quedan NULL ⇒ el historial sigue
 *    mostrando el nombre del concepto (comportamiento actual, sin cambios).
 *
 * Rollback (down): borra la columna.
 */
export class AddMotivoMovimiento1790400000000 implements MigrationInterface {
  name = "AddMotivoMovimiento1790400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "movimiento" ADD "motivo" character varying(60)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "movimiento" DROP COLUMN "motivo"`);
  }
}
