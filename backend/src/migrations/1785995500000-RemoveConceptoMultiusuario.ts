import { MigrationInterface, QueryRunner } from "typeorm";

// La tabla `concepto` deja de ser multiusuario: vuelve a ser global/compartida.
// Se eliminan la FK a usuario y el flag `sistema` (ya no hay conceptos del
// sistema vs. del usuario). Su CRUD pasa a protegerse por rol admin (ver
// `AddEsAdminUsuario` y `requireAdmin()` en backend/src/lib/auth.ts).
export class RemoveConceptoMultiusuario1785995500000 implements MigrationInterface {
    name = 'RemoveConceptoMultiusuario1785995500000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "concepto" DROP CONSTRAINT "FK_4757125849cafb20dcb7f42cf47"`);
        await queryRunner.query(`ALTER TABLE "concepto" DROP COLUMN "usuarioId"`);
        await queryRunner.query(`ALTER TABLE "concepto" DROP COLUMN "sistema"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "concepto" ADD "sistema" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "concepto" ADD "usuarioId" integer`);
        // Restaura los conceptos como compartidos (sin dueño).
        await queryRunner.query(`UPDATE "concepto" SET "sistema" = true`);
        await queryRunner.query(`ALTER TABLE "concepto" ADD CONSTRAINT "FK_4757125849cafb20dcb7f42cf47" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }
}
