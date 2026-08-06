import { MigrationInterface, QueryRunner } from "typeorm";

// Las restricciones UNIQUE(nombre) GLOBALES de las tablas multiusuario pasan a
// compuestas por dueño: un mismo nombre puede existir en usuarios distintos,
// pero no repetirse dentro del mismo usuario.
//   - persona, cuenta, trabajo, tarjeta, categoria_gasto → UNIQUE(nombre, usuarioId)
//   - periodo_tarjeta (sin usuarioId directo) → UNIQUE(nombre, tarjetaId)
// (concepto, moneda, tipo_cuenta y usuario.email siguen UNIQUE global a propósito.)
export class UniqueNombrePorUsuario1785995600000 implements MigrationInterface {
    name = 'UniqueNombrePorUsuario1785995600000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ---- persona ----
        await queryRunner.query(`ALTER TABLE "persona" DROP CONSTRAINT "UQ_0f6c4bb107de1bac4c8ee93e69f"`);
        await queryRunner.query(`ALTER TABLE "persona" ADD CONSTRAINT "UQ_persona_nombre_usuario" UNIQUE ("nombre", "usuarioId")`);

        // ---- cuenta ----
        await queryRunner.query(`ALTER TABLE "cuenta" DROP CONSTRAINT "UQ_ee265955f6768aca0ca4faabec1"`);
        await queryRunner.query(`ALTER TABLE "cuenta" ADD CONSTRAINT "UQ_cuenta_nombre_usuario" UNIQUE ("nombre", "usuarioId")`);

        // ---- trabajo ----
        await queryRunner.query(`ALTER TABLE "trabajo" DROP CONSTRAINT "UQ_3b4abc93ca0efae6b4978488a46"`);
        await queryRunner.query(`ALTER TABLE "trabajo" ADD CONSTRAINT "UQ_trabajo_nombre_usuario" UNIQUE ("nombre", "usuarioId")`);

        // ---- tarjeta ----
        await queryRunner.query(`ALTER TABLE "tarjeta" DROP CONSTRAINT "UQ_d6cbf4b72e534757205131bf026"`);
        await queryRunner.query(`ALTER TABLE "tarjeta" ADD CONSTRAINT "UQ_tarjeta_nombre_usuario" UNIQUE ("nombre", "usuarioId")`);

        // ---- categoria_gasto ----
        await queryRunner.query(`ALTER TABLE "categoria_gasto" DROP CONSTRAINT "UQ_987006b55199e71412cb35e5f89"`);
        await queryRunner.query(`ALTER TABLE "categoria_gasto" ADD CONSTRAINT "UQ_categoria_gasto_nombre_usuario" UNIQUE ("nombre", "usuarioId")`);

        // ---- periodo_tarjeta ----
        await queryRunner.query(`ALTER TABLE "periodo_tarjeta" DROP CONSTRAINT "UQ_c1c8b387105b617d06f6535e595"`);
        await queryRunner.query(`ALTER TABLE "periodo_tarjeta" ADD CONSTRAINT "UQ_periodo_tarjeta_nombre_tarjeta" UNIQUE ("nombre", "tarjetaId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "persona" DROP CONSTRAINT "UQ_persona_nombre_usuario"`);
        await queryRunner.query(`ALTER TABLE "persona" ADD CONSTRAINT "UQ_0f6c4bb107de1bac4c8ee93e69f" UNIQUE ("nombre")`);

        await queryRunner.query(`ALTER TABLE "cuenta" DROP CONSTRAINT "UQ_cuenta_nombre_usuario"`);
        await queryRunner.query(`ALTER TABLE "cuenta" ADD CONSTRAINT "UQ_ee265955f6768aca0ca4faabec1" UNIQUE ("nombre")`);

        await queryRunner.query(`ALTER TABLE "trabajo" DROP CONSTRAINT "UQ_trabajo_nombre_usuario"`);
        await queryRunner.query(`ALTER TABLE "trabajo" ADD CONSTRAINT "UQ_3b4abc93ca0efae6b4978488a46" UNIQUE ("nombre")`);

        await queryRunner.query(`ALTER TABLE "tarjeta" DROP CONSTRAINT "UQ_tarjeta_nombre_usuario"`);
        await queryRunner.query(`ALTER TABLE "tarjeta" ADD CONSTRAINT "UQ_d6cbf4b72e534757205131bf026" UNIQUE ("nombre")`);

        await queryRunner.query(`ALTER TABLE "categoria_gasto" DROP CONSTRAINT "UQ_categoria_gasto_nombre_usuario"`);
        await queryRunner.query(`ALTER TABLE "categoria_gasto" ADD CONSTRAINT "UQ_987006b55199e71412cb35e5f89" UNIQUE ("nombre")`);

        await queryRunner.query(`ALTER TABLE "periodo_tarjeta" DROP CONSTRAINT "UQ_periodo_tarjeta_nombre_tarjeta"`);
        await queryRunner.query(`ALTER TABLE "periodo_tarjeta" ADD CONSTRAINT "UQ_c1c8b387105b617d06f6535e595" UNIQUE ("nombre")`);
    }
}
