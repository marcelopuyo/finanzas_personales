import { MigrationInterface, QueryRunner } from "typeorm";

// Soft-delete de usuarios: campo `eliminado` (boolean, default false).
// Al "eliminar" un usuario se marca en true (NO se borra de la BD: borrar haría
// CASCADE por la FK usuarioId y eliminaría TODOS sus datos).
export class AddEliminadoUsuario1785995700000 implements MigrationInterface {
    name = 'AddEliminadoUsuario1785995700000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuario" ADD "eliminado" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuario" DROP COLUMN "eliminado"`);
    }
}
