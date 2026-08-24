import { MigrationInterface, QueryRunner } from "typeorm";

// Agrega los conceptos globales "Prestamo Otorgado" (Egreso) y
// "Prestamo Obtenido" (Ingreso), usados por el alta de préstamos
// (crearPrestamo) para registrar el movimiento en el historial de la cuenta
// desde/hacia la cual se mueve el dinero (antes el alta NO creaba movimiento
// y por eso los préstamos no aparecían en el popup de historial).
export class AddConceptosPrestamo1787600000000 implements MigrationInterface {
    name = 'AddConceptosPrestamo1787600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `INSERT INTO "concepto" ("nombre", "categoria", "eliminado")
             SELECT 'Prestamo Otorgado', 'Egreso', false
             WHERE NOT EXISTS (SELECT 1 FROM "concepto" WHERE "nombre" = 'Prestamo Otorgado')`
        );
        await queryRunner.query(
            `INSERT INTO "concepto" ("nombre", "categoria", "eliminado")
             SELECT 'Prestamo Obtenido', 'Ingreso', false
             WHERE NOT EXISTS (SELECT 1 FROM "concepto" WHERE "nombre" = 'Prestamo Obtenido')`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DELETE FROM "concepto" WHERE "nombre" IN ('Prestamo Otorgado', 'Prestamo Obtenido')`
        );
    }
}
