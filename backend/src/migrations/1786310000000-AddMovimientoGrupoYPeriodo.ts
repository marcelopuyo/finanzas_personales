import { MigrationInterface, QueryRunner } from "typeorm";

// Soporte para anular/revertir movimientos desde el histórico de cuenta:
//   1. `grupoId` (uuid, nullable) — vincula los 2 movimientos de una
//      transferencia (origen y destino) para revertirlos juntos.
//   2. `periodoTrabajoId` (FK nullable a periodo_trabajo) — en los movimientos
//      "Cobro Sueldo", apunta al período que se cobró, para poder limpiarle
//      `fechaDeCobro` al revertir el cobro.
export class AddMovimientoGrupoYPeriodo1786310000000 implements MigrationInterface {
    name = 'AddMovimientoGrupoYPeriodo1786310000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Grupo de transferencia (los 2 movimientos comparten el mismo uuid).
        await queryRunner.query(`ALTER TABLE "movimiento" ADD "grupoId" uuid`);

        // FK al período de trabajo cobrado.
        await queryRunner.query(`ALTER TABLE "movimiento" ADD "periodoTrabajoId" integer`);
        await queryRunner.query(`ALTER TABLE "movimiento" ADD CONSTRAINT "FK_movimiento_periodo_trabajo" FOREIGN KEY ("periodoTrabajoId") REFERENCES "periodo_trabajo"("id") ON DELETE SET NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movimiento" DROP CONSTRAINT "FK_movimiento_periodo_trabajo"`);
        await queryRunner.query(`ALTER TABLE "movimiento" DROP COLUMN "periodoTrabajoId"`);
        await queryRunner.query(`ALTER TABLE "movimiento" DROP COLUMN "grupoId"`);
    }
}
