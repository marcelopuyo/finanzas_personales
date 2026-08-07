import { MigrationInterface, QueryRunner } from "typeorm";

// Agrega el concepto global "Cobro Propina" (Ingreso), usado por el wizard
// "Jornada trabajo" para depositar la propina en la cuenta seleccionada.
export class AddConceptoCobroPropina1786000000000 implements MigrationInterface {
    name = 'AddConceptoCobroPropina1786000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `INSERT INTO "concepto" ("nombre", "categoria", "eliminado")
             SELECT 'Cobro Propina', 'Ingreso', false
             WHERE NOT EXISTS (SELECT 1 FROM "concepto" WHERE "nombre" = 'Cobro Propina')`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "concepto" WHERE "nombre" = 'Cobro Propina'`);
    }
}
