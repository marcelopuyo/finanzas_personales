import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUsuarioIdMultiTenant1785994627199 implements MigrationInterface {
    name = 'AddUsuarioIdMultiTenant1785994627199'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "concepto" ADD "sistema" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "concepto" ADD "usuarioId" integer`);
        await queryRunner.query(`ALTER TABLE "persona" ADD "usuarioId" integer`);
        await queryRunner.query(`ALTER TABLE "cuenta" ADD "usuarioId" integer`);
        await queryRunner.query(`ALTER TABLE "cotizacion" ADD "usuarioId" integer`);
        await queryRunner.query(`ALTER TABLE "inflacion" ADD "usuarioId" integer`);
        await queryRunner.query(`ALTER TABLE "categoria_gasto" ADD "usuarioId" integer`);
        await queryRunner.query(`ALTER TABLE "periodo_gasto" ADD "usuarioId" integer`);
        await queryRunner.query(`ALTER TABLE "gasto" ADD "usuarioId" integer`);
        await queryRunner.query(`ALTER TABLE "tarjeta" ADD "usuarioId" integer`);
        await queryRunner.query(`ALTER TABLE "trabajo" ADD "usuarioId" integer`);
        await queryRunner.query(`ALTER TABLE "prestamo" ADD "usuarioId" integer`);

        // ---- Backfill: los datos existentes pertenecen al admin (id=1) ----
        await queryRunner.query(`UPDATE "concepto" SET "usuarioId" = 1 WHERE "usuarioId" IS NULL`);
        await queryRunner.query(`UPDATE "persona" SET "usuarioId" = 1`);
        await queryRunner.query(`UPDATE "cuenta" SET "usuarioId" = 1`);
        await queryRunner.query(`UPDATE "cotizacion" SET "usuarioId" = 1`);
        await queryRunner.query(`UPDATE "inflacion" SET "usuarioId" = 1`);
        await queryRunner.query(`UPDATE "categoria_gasto" SET "usuarioId" = 1`);
        await queryRunner.query(`UPDATE "periodo_gasto" SET "usuarioId" = 1`);
        await queryRunner.query(`UPDATE "gasto" SET "usuarioId" = 1`);
        await queryRunner.query(`UPDATE "tarjeta" SET "usuarioId" = 1`);
        await queryRunner.query(`UPDATE "trabajo" SET "usuarioId" = 1`);
        await queryRunner.query(`UPDATE "prestamo" SET "usuarioId" = 1`);

        // ---- Los conceptos existentes son del sistema (compartidos) ----
        await queryRunner.query(`UPDATE "concepto" SET "sistema" = true`);
        // Los conceptos del sistema NO tienen dueño: si se elimina el admin,
        // no deben borrarse los conceptos compartidos.
        await queryRunner.query(`UPDATE "concepto" SET "usuarioId" = NULL WHERE "sistema" = true`);

        // ---- NOT NULL (excepto concepto: los del sistema no tienen dueño) ----
        await queryRunner.query(`ALTER TABLE "persona" ALTER COLUMN "usuarioId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "cuenta" ALTER COLUMN "usuarioId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "cotizacion" ALTER COLUMN "usuarioId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "inflacion" ALTER COLUMN "usuarioId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "categoria_gasto" ALTER COLUMN "usuarioId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "periodo_gasto" ALTER COLUMN "usuarioId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "gasto" ALTER COLUMN "usuarioId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tarjeta" ALTER COLUMN "usuarioId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "trabajo" ALTER COLUMN "usuarioId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "prestamo" ALTER COLUMN "usuarioId" SET NOT NULL`);

        await queryRunner.query(`ALTER TABLE "concepto" ADD CONSTRAINT "FK_4757125849cafb20dcb7f42cf47" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "persona" ADD CONSTRAINT "FK_8a21418dd09f3db7e7aa588a2f4" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cuenta" ADD CONSTRAINT "FK_9081f7537e53ba27c763ea2eb56" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cotizacion" ADD CONSTRAINT "FK_175f7adbc18f70a7a2e6414278e" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inflacion" ADD CONSTRAINT "FK_c2e2df2e5da1e66dc5a6579d21d" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "categoria_gasto" ADD CONSTRAINT "FK_25aea44c3af047a53f9738f2ecf" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "periodo_gasto" ADD CONSTRAINT "FK_31d09b425975b75f5433fc28d8e" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "gasto" ADD CONSTRAINT "FK_c20897d814bf69df528767fdb4f" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tarjeta" ADD CONSTRAINT "FK_cd5145fb9cf35830b2a681c2180" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trabajo" ADD CONSTRAINT "FK_e21640879025d74d95dffb891a3" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "prestamo" ADD CONSTRAINT "FK_47e071a1da16d0318647c641d2e" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "prestamo" DROP CONSTRAINT "FK_47e071a1da16d0318647c641d2e"`);
        await queryRunner.query(`ALTER TABLE "trabajo" DROP CONSTRAINT "FK_e21640879025d74d95dffb891a3"`);
        await queryRunner.query(`ALTER TABLE "tarjeta" DROP CONSTRAINT "FK_cd5145fb9cf35830b2a681c2180"`);
        await queryRunner.query(`ALTER TABLE "gasto" DROP CONSTRAINT "FK_c20897d814bf69df528767fdb4f"`);
        await queryRunner.query(`ALTER TABLE "periodo_gasto" DROP CONSTRAINT "FK_31d09b425975b75f5433fc28d8e"`);
        await queryRunner.query(`ALTER TABLE "categoria_gasto" DROP CONSTRAINT "FK_25aea44c3af047a53f9738f2ecf"`);
        await queryRunner.query(`ALTER TABLE "inflacion" DROP CONSTRAINT "FK_c2e2df2e5da1e66dc5a6579d21d"`);
        await queryRunner.query(`ALTER TABLE "cotizacion" DROP CONSTRAINT "FK_175f7adbc18f70a7a2e6414278e"`);
        await queryRunner.query(`ALTER TABLE "cuenta" DROP CONSTRAINT "FK_9081f7537e53ba27c763ea2eb56"`);
        await queryRunner.query(`ALTER TABLE "persona" DROP CONSTRAINT "FK_8a21418dd09f3db7e7aa588a2f4"`);
        await queryRunner.query(`ALTER TABLE "concepto" DROP CONSTRAINT "FK_4757125849cafb20dcb7f42cf47"`);
        await queryRunner.query(`ALTER TABLE "prestamo" DROP COLUMN "usuarioId"`);
        await queryRunner.query(`ALTER TABLE "trabajo" DROP COLUMN "usuarioId"`);
        await queryRunner.query(`ALTER TABLE "tarjeta" DROP COLUMN "usuarioId"`);
        await queryRunner.query(`ALTER TABLE "gasto" DROP COLUMN "usuarioId"`);
        await queryRunner.query(`ALTER TABLE "periodo_gasto" DROP COLUMN "usuarioId"`);
        await queryRunner.query(`ALTER TABLE "categoria_gasto" DROP COLUMN "usuarioId"`);
        await queryRunner.query(`ALTER TABLE "inflacion" DROP COLUMN "usuarioId"`);
        await queryRunner.query(`ALTER TABLE "cotizacion" DROP COLUMN "usuarioId"`);
        await queryRunner.query(`ALTER TABLE "cuenta" DROP COLUMN "usuarioId"`);
        await queryRunner.query(`ALTER TABLE "persona" DROP COLUMN "usuarioId"`);
        await queryRunner.query(`ALTER TABLE "concepto" DROP COLUMN "usuarioId"`);
        await queryRunner.query(`ALTER TABLE "concepto" DROP COLUMN "sistema"`);
    }

}
