import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Préstamos en el Balance Actual (§13 del plan de préstamos, 2026-09-10):
 * flag POR USUARIO para decidir si el saldo NETO de los préstamos
 * (Σ saldo otorgado − Σ saldo obtenido) forma parte del Balance Actual.
 *
 * Arranca en **false** (decisión del usuario): el balance no cambia hasta que
 * se active el switch de la fila "Préstamos (neto)" del CRUD de Cuentas.
 */
export class AddIncluirPrestamosEnBalanceUsuario1789800000000
  implements MigrationInterface
{
  name = "AddIncluirPrestamosEnBalanceUsuario1789800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuario" ADD "incluirPrestamosEnBalance" boolean NOT NULL DEFAULT false`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuario" DROP COLUMN "incluirPrestamosEnBalance"`
    );
  }
}
