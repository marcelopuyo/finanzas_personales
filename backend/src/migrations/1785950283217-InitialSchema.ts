import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1785950283217 implements MigrationInterface {
    name = 'InitialSchema1785950283217'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Extensión requerida para el DEFAULT uuid_generate_v4() de los PK uuid
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "concepto" ("id" SERIAL NOT NULL, "nombre" character varying NOT NULL, "eliminado" boolean NOT NULL DEFAULT false, "categoria" character varying, CONSTRAINT "UQ_5f47f72209a93989d2d03bfa48a" UNIQUE ("nombre"), CONSTRAINT "PK_58128f6ae7c9aba37e8b54777e3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "persona" ("id" SERIAL NOT NULL, "nombre" character varying NOT NULL, "telefono" character varying, "mail" character varying, "eliminado" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_0f6c4bb107de1bac4c8ee93e69f" UNIQUE ("nombre"), CONSTRAINT "PK_13aefc75f60510f2be4cd243d71" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "moneda" ("id" SERIAL NOT NULL, "simbolo" character varying NOT NULL, "nombre" character varying NOT NULL, "eliminado" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_08917e6d8dc0e1439126ac80193" UNIQUE ("nombre"), CONSTRAINT "PK_2e50d42dc0a857054e3b7078c8f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tipo_cuenta" ("id" SERIAL NOT NULL, "nombre" character varying NOT NULL, "eliminado" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_a54fcf6b2cad57a14933e273b04" UNIQUE ("nombre"), CONSTRAINT "PK_2f1ad8af316fc1cd743fe43b8b4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "cuenta" ("id" SERIAL NOT NULL, "nombre" character varying NOT NULL, "saldo" numeric(10,2) NOT NULL DEFAULT '0', "eliminado" boolean NOT NULL DEFAULT false, "tarjetaId" integer, "tipoId" integer, "monedaId" integer, CONSTRAINT "UQ_ee265955f6768aca0ca4faabec1" UNIQUE ("nombre"), CONSTRAINT "PK_c4a76091d90bd15f5c65e9c76b7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "cotizacion" ("id" SERIAL NOT NULL, "fechaInicial" date NOT NULL, "fechaFinal" date NOT NULL, "cotizacion" numeric(10,2) NOT NULL DEFAULT '0', "eliminado" boolean NOT NULL DEFAULT false, "monedaId" integer, CONSTRAINT "PK_84a2ae8abd0e7f658978b29a4b9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "historico_cuenta" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fechaDesde" TIMESTAMP NOT NULL, "fechaHasta" TIMESTAMP, "saldo" numeric(10,2) NOT NULL DEFAULT '0', "eliminado" boolean NOT NULL DEFAULT false, "cuentaId" integer, "movimientoId" uuid, CONSTRAINT "REL_de455578e209de0ef52fb5556d" UNIQUE ("movimientoId"), CONSTRAINT "PK_01cb3d1d10296794cf2bf0d8e74" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "inflacion" ("id" SERIAL NOT NULL, "fechaInicial" date NOT NULL, "fechaFinal" date NOT NULL, "indice" numeric(10,2) NOT NULL DEFAULT '0', "eliminado" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_52ba5b2f8d558dfcc203055581c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "categoria_gasto" ("id" SERIAL NOT NULL, "nombre" character varying NOT NULL, "eliminado" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_987006b55199e71412cb35e5f89" UNIQUE ("nombre"), CONSTRAINT "PK_2071d4582ff40d61ab4e4749279" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "periodo_gasto" ("id" SERIAL NOT NULL, "nombre" character varying NOT NULL, "fechaApertura" date NOT NULL, "fechaCierre" date NOT NULL, "eliminado" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_d0e58fbaababfd9843dfce9ed67" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "gasto" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "descripcion" character varying, "monto" numeric(10,2) NOT NULL DEFAULT '0', "saldo" numeric(10,2) NOT NULL DEFAULT '0', "fechaVencimiento" date, "fechaPago" date, "isPeriodico" boolean NOT NULL DEFAULT false, "eliminado" boolean NOT NULL DEFAULT false, "periodoId" integer, "categoriaId" integer, CONSTRAINT "PK_cf2336fd738eaca8aab31dcb07b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tarjeta" ("id" SERIAL NOT NULL, "nombre" character varying NOT NULL, "banco" character varying NOT NULL, "numero" character varying NOT NULL, "eliminado" boolean NOT NULL DEFAULT false, "cuentaId" integer, CONSTRAINT "UQ_d6cbf4b72e534757205131bf026" UNIQUE ("nombre"), CONSTRAINT "REL_19d6d5399d8797742f0fe082f5" UNIQUE ("cuentaId"), CONSTRAINT "PK_b1540d7d57fc00ef80fd729ee07" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "periodo_tarjeta" ("id" SERIAL NOT NULL, "nombre" character varying NOT NULL, "fechaApertura" date NOT NULL, "fechaCierre" date NOT NULL, "fechaVencimiento" date NOT NULL, "eliminado" boolean NOT NULL DEFAULT false, "tarjetaId" integer, CONSTRAINT "UQ_c1c8b387105b617d06f6535e595" UNIQUE ("nombre"), CONSTRAINT "PK_7d7af24c9ba61f2cb22e00aad17" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "movimiento_tarjeta" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "detalle" character varying NOT NULL, "fecha" date NOT NULL, "monto" numeric(10,2) NOT NULL DEFAULT '0', "cuotas" integer NOT NULL, "eliminado" boolean NOT NULL DEFAULT false, "tarjetaId" integer, "personaId" integer, "periodoId" integer, CONSTRAINT "PK_f9b9af7d8d5a839986b05de64da" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "trabajo" ("id" SERIAL NOT NULL, "nombre" character varying NOT NULL, "fechaInicio" date NOT NULL, "precioHora" numeric(10,2) NOT NULL DEFAULT '0', "memos" character varying, "eliminado" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_3b4abc93ca0efae6b4978488a46" UNIQUE ("nombre"), CONSTRAINT "PK_480f8c48e0bea1174b009222d9e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "periodo_trabajo" ("id" SERIAL NOT NULL, "fechaDesde" date NOT NULL, "fechaHasta" date NOT NULL, "montoACobrar" numeric(10,2) DEFAULT '0', "fechaEstimadaCobro" date, "fechaDeCobro" date, "eliminado" boolean NOT NULL DEFAULT false, "trabajoId" integer, CONSTRAINT "PK_91620ab1c768d916aad760f5c37" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "jornada_trabajo" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fechaJornada" date NOT NULL, "fechaCarga" date NOT NULL, "horaDesde" numeric(10,2) NOT NULL DEFAULT '0', "horaHasta" numeric(10,2) NOT NULL DEFAULT '0', "montoJornada" numeric(10,2) NOT NULL DEFAULT '0', "montoPropina" numeric(10,2) NOT NULL DEFAULT '0', "eliminado" boolean NOT NULL DEFAULT false, "periodoTrabajoId" integer, CONSTRAINT "PK_a8747dfd369c6de39ab7374baba" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "prestamo" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "detalle" character varying NOT NULL, "fecha" date NOT NULL, "monto" numeric(10,2) NOT NULL DEFAULT '0', "saldo" numeric(10,2) NOT NULL DEFAULT '0', "cuotas" integer NOT NULL, "sentido" character varying NOT NULL, "eliminado" boolean NOT NULL DEFAULT false, "personaOrigenId" integer, "personaDestinoId" integer, "cuentaId" integer, CONSTRAINT "PK_f278f946a735410406b7d965b2a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "movimiento" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fecha" date NOT NULL, "monto" numeric(10,2) NOT NULL DEFAULT '0', "eliminado" boolean NOT NULL DEFAULT false, "conceptoId" integer, "cuentaId" integer, "prestamoId" uuid, "gastoId" uuid, CONSTRAINT "PK_809988d143ce94a95f3d30164ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "cuenta" ADD CONSTRAINT "FK_86fd9c882daf51251f96c4fa66e" FOREIGN KEY ("tipoId") REFERENCES "tipo_cuenta"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cuenta" ADD CONSTRAINT "FK_122a80c202b8c1dd04a8879a098" FOREIGN KEY ("monedaId") REFERENCES "moneda"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cotizacion" ADD CONSTRAINT "FK_d9f69145212447223d9be87813f" FOREIGN KEY ("monedaId") REFERENCES "moneda"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "historico_cuenta" ADD CONSTRAINT "FK_a3e2e5f5d338715e012e90bb87c" FOREIGN KEY ("cuentaId") REFERENCES "cuenta"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "historico_cuenta" ADD CONSTRAINT "FK_de455578e209de0ef52fb5556d8" FOREIGN KEY ("movimientoId") REFERENCES "movimiento"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "gasto" ADD CONSTRAINT "FK_5b76348ff10bcb39da77a41042f" FOREIGN KEY ("periodoId") REFERENCES "periodo_gasto"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "gasto" ADD CONSTRAINT "FK_b169905d113ec772de065a884c3" FOREIGN KEY ("categoriaId") REFERENCES "categoria_gasto"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tarjeta" ADD CONSTRAINT "FK_19d6d5399d8797742f0fe082f52" FOREIGN KEY ("cuentaId") REFERENCES "cuenta"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "periodo_tarjeta" ADD CONSTRAINT "FK_438d943634aadddcd8c9c4686f9" FOREIGN KEY ("tarjetaId") REFERENCES "tarjeta"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "movimiento_tarjeta" ADD CONSTRAINT "FK_5dff1f02683fdd53b55ac1592ba" FOREIGN KEY ("tarjetaId") REFERENCES "tarjeta"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "movimiento_tarjeta" ADD CONSTRAINT "FK_7d8628c25e905f0e4bb0d6a680a" FOREIGN KEY ("personaId") REFERENCES "persona"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "movimiento_tarjeta" ADD CONSTRAINT "FK_98732ab190c560c6b7b67be3093" FOREIGN KEY ("periodoId") REFERENCES "periodo_tarjeta"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "periodo_trabajo" ADD CONSTRAINT "FK_f4fcca116a2d758c7d31858fb14" FOREIGN KEY ("trabajoId") REFERENCES "trabajo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "jornada_trabajo" ADD CONSTRAINT "FK_ddfedb0268ed832ef674fcd2190" FOREIGN KEY ("periodoTrabajoId") REFERENCES "periodo_trabajo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "prestamo" ADD CONSTRAINT "FK_c0e5514e8a66068e62c449f09ca" FOREIGN KEY ("personaOrigenId") REFERENCES "persona"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "prestamo" ADD CONSTRAINT "FK_e51927df7041eed8151b4aba184" FOREIGN KEY ("personaDestinoId") REFERENCES "persona"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "prestamo" ADD CONSTRAINT "FK_eee86f88add2b42a738971083d0" FOREIGN KEY ("cuentaId") REFERENCES "cuenta"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "movimiento" ADD CONSTRAINT "FK_7dbfa895c6cc6835d6a2429b5c7" FOREIGN KEY ("conceptoId") REFERENCES "concepto"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "movimiento" ADD CONSTRAINT "FK_fd25067327d9d6ba146ef5b6005" FOREIGN KEY ("cuentaId") REFERENCES "cuenta"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "movimiento" ADD CONSTRAINT "FK_36182df0a74f3d7c435c1c38a50" FOREIGN KEY ("prestamoId") REFERENCES "prestamo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "movimiento" ADD CONSTRAINT "FK_4c01d00c26073f019e938e067fd" FOREIGN KEY ("gastoId") REFERENCES "gasto"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movimiento" DROP CONSTRAINT "FK_4c01d00c26073f019e938e067fd"`);
        await queryRunner.query(`ALTER TABLE "movimiento" DROP CONSTRAINT "FK_36182df0a74f3d7c435c1c38a50"`);
        await queryRunner.query(`ALTER TABLE "movimiento" DROP CONSTRAINT "FK_fd25067327d9d6ba146ef5b6005"`);
        await queryRunner.query(`ALTER TABLE "movimiento" DROP CONSTRAINT "FK_7dbfa895c6cc6835d6a2429b5c7"`);
        await queryRunner.query(`ALTER TABLE "prestamo" DROP CONSTRAINT "FK_eee86f88add2b42a738971083d0"`);
        await queryRunner.query(`ALTER TABLE "prestamo" DROP CONSTRAINT "FK_e51927df7041eed8151b4aba184"`);
        await queryRunner.query(`ALTER TABLE "prestamo" DROP CONSTRAINT "FK_c0e5514e8a66068e62c449f09ca"`);
        await queryRunner.query(`ALTER TABLE "jornada_trabajo" DROP CONSTRAINT "FK_ddfedb0268ed832ef674fcd2190"`);
        await queryRunner.query(`ALTER TABLE "periodo_trabajo" DROP CONSTRAINT "FK_f4fcca116a2d758c7d31858fb14"`);
        await queryRunner.query(`ALTER TABLE "movimiento_tarjeta" DROP CONSTRAINT "FK_98732ab190c560c6b7b67be3093"`);
        await queryRunner.query(`ALTER TABLE "movimiento_tarjeta" DROP CONSTRAINT "FK_7d8628c25e905f0e4bb0d6a680a"`);
        await queryRunner.query(`ALTER TABLE "movimiento_tarjeta" DROP CONSTRAINT "FK_5dff1f02683fdd53b55ac1592ba"`);
        await queryRunner.query(`ALTER TABLE "periodo_tarjeta" DROP CONSTRAINT "FK_438d943634aadddcd8c9c4686f9"`);
        await queryRunner.query(`ALTER TABLE "tarjeta" DROP CONSTRAINT "FK_19d6d5399d8797742f0fe082f52"`);
        await queryRunner.query(`ALTER TABLE "gasto" DROP CONSTRAINT "FK_b169905d113ec772de065a884c3"`);
        await queryRunner.query(`ALTER TABLE "gasto" DROP CONSTRAINT "FK_5b76348ff10bcb39da77a41042f"`);
        await queryRunner.query(`ALTER TABLE "historico_cuenta" DROP CONSTRAINT "FK_de455578e209de0ef52fb5556d8"`);
        await queryRunner.query(`ALTER TABLE "historico_cuenta" DROP CONSTRAINT "FK_a3e2e5f5d338715e012e90bb87c"`);
        await queryRunner.query(`ALTER TABLE "cotizacion" DROP CONSTRAINT "FK_d9f69145212447223d9be87813f"`);
        await queryRunner.query(`ALTER TABLE "cuenta" DROP CONSTRAINT "FK_122a80c202b8c1dd04a8879a098"`);
        await queryRunner.query(`ALTER TABLE "cuenta" DROP CONSTRAINT "FK_86fd9c882daf51251f96c4fa66e"`);
        await queryRunner.query(`DROP TABLE "movimiento"`);
        await queryRunner.query(`DROP TABLE "prestamo"`);
        await queryRunner.query(`DROP TABLE "jornada_trabajo"`);
        await queryRunner.query(`DROP TABLE "periodo_trabajo"`);
        await queryRunner.query(`DROP TABLE "trabajo"`);
        await queryRunner.query(`DROP TABLE "movimiento_tarjeta"`);
        await queryRunner.query(`DROP TABLE "periodo_tarjeta"`);
        await queryRunner.query(`DROP TABLE "tarjeta"`);
        await queryRunner.query(`DROP TABLE "gasto"`);
        await queryRunner.query(`DROP TABLE "periodo_gasto"`);
        await queryRunner.query(`DROP TABLE "categoria_gasto"`);
        await queryRunner.query(`DROP TABLE "inflacion"`);
        await queryRunner.query(`DROP TABLE "historico_cuenta"`);
        await queryRunner.query(`DROP TABLE "cotizacion"`);
        await queryRunner.query(`DROP TABLE "cuenta"`);
        await queryRunner.query(`DROP TABLE "tipo_cuenta"`);
        await queryRunner.query(`DROP TABLE "moneda"`);
        await queryRunner.query(`DROP TABLE "persona"`);
        await queryRunner.query(`DROP TABLE "concepto"`);
    }

}
