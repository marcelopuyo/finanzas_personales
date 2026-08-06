import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUsuario1785993804274 implements MigrationInterface {
    name = 'AddUsuario1785993804274'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "usuario" ("id" SERIAL NOT NULL, "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "nombre" character varying, "emailVerificado" boolean NOT NULL DEFAULT false, "activo" boolean NOT NULL DEFAULT true, "creadoEn" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2863682842e688ca198eb25c124" UNIQUE ("email"), CONSTRAINT "PK_a56c58e5cabaa04fb2c98d2d7e2" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "usuario"`);
    }

}
