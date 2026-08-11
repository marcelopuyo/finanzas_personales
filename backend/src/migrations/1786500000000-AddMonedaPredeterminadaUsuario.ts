import { MigrationInterface, QueryRunner } from "typeorm";

// Cada usuario tiene una moneda "predeterminada" (FK a `moneda`). Es la moneda
// en la que se muestra el balance actual y las tarjetas sintéticas del
// dashboard. Al darse de alta un usuario, el default es "Dolar Estadounidense";
// el usuario puede cambiarla desde su perfil.
export class AddMonedaPredeterminadaUsuario1786500000000 implements MigrationInterface {
    name = 'AddMonedaPredeterminadaUsuario1786500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuario" ADD "monedaPredeterminadaId" integer`);
        // Backfill: todos los usuarios existentes quedan con Dólar Estadounidense.
        await queryRunner.query(`UPDATE "usuario" SET "monedaPredeterminadaId" = (SELECT id FROM "moneda" WHERE "nombre" = 'Dolar Estadounidense' AND "eliminado" = false)`);
        await queryRunner.query(`ALTER TABLE "usuario" ALTER COLUMN "monedaPredeterminadaId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "usuario" ADD CONSTRAINT "FK_usuario_moneda_predeterminada" FOREIGN KEY ("monedaPredeterminadaId") REFERENCES "moneda"("id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuario" DROP CONSTRAINT "FK_usuario_moneda_predeterminada"`);
        await queryRunner.query(`ALTER TABLE "usuario" DROP COLUMN "monedaPredeterminadaId"`);
    }
}
