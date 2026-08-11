import { MigrationInterface, QueryRunner } from "typeorm";

// Agrega `moneda.codigoISO` (código ISO 4217, ej. "ARS"/"USD") para que el
// formateo de montos sea 100% data-driven (toLocaleString usa el código ISO,
// no el símbolo). Backfill de las monedas existentes por nombre.
export class AddCodigoISOAMoneda1786490000000 implements MigrationInterface {
    name = 'AddCodigoISOAMoneda1786490000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "moneda" ADD "codigoISO" character varying`);
        await queryRunner.query(`UPDATE "moneda" SET "codigoISO" = 'ARS' WHERE "nombre" = 'Peso Argentino'`);
        await queryRunner.query(`UPDATE "moneda" SET "codigoISO" = 'USD' WHERE "nombre" = 'Dolar Estadounidense'`);
        await queryRunner.query(`ALTER TABLE "moneda" ALTER COLUMN "codigoISO" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "moneda" DROP COLUMN "codigoISO"`);
    }
}
