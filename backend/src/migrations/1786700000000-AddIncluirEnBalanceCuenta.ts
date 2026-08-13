import { MigrationInterface, QueryRunner } from "typeorm";

// Agrega `cuenta.incluirEnBalance` (boolean, default true): indica si la cuenta
// forma parte del cálculo del "Balance Actual" del dashboard. El usuario lo
// configura desde el CRUD de cuentas; al crear una cuenta queda activo por
// defecto (checkbox habilitado).
//
// Backfill: las cuentas que ANTES participaban del balance (dólares + tipo
// "Cuenta Bancaria"/"Caja Fisica") quedan con `true` (default). Las de otras
// monedas/tipos quedan con `false` para NO cambiar el balance de un día para
// el otro; el usuario decide después cuáles incluir.
export class AddIncluirEnBalanceCuenta1786700000000
  implements MigrationInterface {
  name = "AddIncluirEnBalanceCuenta1786700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cuenta" ADD "incluirEnBalance" boolean NOT NULL DEFAULT true`
    );
    // Backfill: apaga las cuentas que no cumplían la regla anterior.
    await queryRunner.query(
      `UPDATE "cuenta" c SET "incluirEnBalance" = false WHERE NOT (
         c."tipoId" IN (
           SELECT t."id" FROM "tipo_cuenta" t
           WHERE t."nombre" IN ('Cuenta Bancaria', 'Caja Fisica') AND t."eliminado" = false
         )
         AND c."monedaId" IN (
           SELECT m."id" FROM "moneda" m
           WHERE m."nombre" = 'Dolar Estadounidense' AND m."eliminado" = false
         )
       )`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cuenta" DROP COLUMN "incluirEnBalance"`);
  }
}
