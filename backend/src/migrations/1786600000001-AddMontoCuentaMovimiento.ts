import { MigrationInterface, QueryRunner } from "typeorm";

// `movimiento.montoCuentaMonedaOrigen`: monto real en la moneda de la cuenta
// (el delta que aplica al saldo). `monto` queda en la moneda predeterminada
// del usuario (convertido). Se guarda el monto de cuenta para que las
// reversiones y el historial no dependan de una tasa histórica.
export class AddMontoCuentaMovimiento1786600000001 implements MigrationInterface {
    name = 'AddMontoCuentaMovimiento1786600000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movimiento" ADD "montoCuentaMonedaOrigen" numeric(10,2) NOT NULL DEFAULT 0`);
        // Backfill: los movimientos existentes tenían `monto` = monto de la cuenta.
        await queryRunner.query(`UPDATE "movimiento" SET "montoCuentaMonedaOrigen" = "monto"`);
        // La app siempre lo setea explícitamente.
        await queryRunner.query(`ALTER TABLE "movimiento" ALTER COLUMN "montoCuentaMonedaOrigen" DROP DEFAULT`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movimiento" DROP COLUMN "montoCuentaMonedaOrigen"`);
    }
}
