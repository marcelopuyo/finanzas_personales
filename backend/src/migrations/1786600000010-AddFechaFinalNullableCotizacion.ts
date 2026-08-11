import { MigrationInterface, QueryRunner } from "typeorm";

// `cotizacion.fechaFinal` debe permitir NULL: un período VIGENTE (la
// cotización actual de un par) no tiene fecha de cierre. La migración
// AddMonedaDestinoCotizacion no alteró su nullability; se corrige acá.
export class AddFechaFinalNullableCotizacion1786600000010 implements MigrationInterface {
    name = 'AddFechaFinalNullableCotizacion1786600000010'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cotizacion" ALTER COLUMN "fechaFinal" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cotizacion" ALTER COLUMN "fechaFinal" SET NOT NULL`);
    }
}
