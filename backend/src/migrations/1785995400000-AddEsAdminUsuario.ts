import { MigrationInterface, QueryRunner } from "typeorm";

// Agrega el flag de administrador al usuario. Permite proteger recursos
// compartidos (ej. CRUD de Conceptos) solo para administradores.
export class AddEsAdminUsuario1785995400000 implements MigrationInterface {
    name = 'AddEsAdminUsuario1785995400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuario" ADD "esAdmin" boolean NOT NULL DEFAULT false`);
        // Backfill: el usuario admin seed (id=1) es administrador.
        await queryRunner.query(`UPDATE "usuario" SET "esAdmin" = true WHERE id = 1`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuario" DROP COLUMN "esAdmin"`);
    }
}
