import { MigrationInterface, QueryRunner } from "typeorm";

// Remodelación de la infraestructura de Trabajo (2026-09-05):
//  - `trabajo.modalidadCobro` (varchar, default 'horas_variables'): la modalidad
//    de cobro de cada trabajo ('fijo' | 'horas_fijas' | 'horas_variables' | 'por_tarea').
//  - `periodo_trabajo.horasPeriodo` / `precioHoraPeriodo`: snapshot + horas del
//    período para la modalidad 'horas_fijas'.
//  - Nueva tabla `tarea_trabajo`: hijo del período para la modalidad 'por_tarea'
//    (cada tarea con su monto ganado, cargado a mano).
// Backfill: no hay transformación de datos. Todos los trabajos existentes son
// hoy 'horas_variables' → el DEFAULT los deja correctos. `tarea_trabajo` nace vacía.
export class AddModalidadCobroTrabajo1789000000000 implements MigrationInterface {
  name = "AddModalidadCobroTrabajo1789000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trabajo" ADD "modalidadCobro" character varying NOT NULL DEFAULT 'horas_variables'`
    );
    await queryRunner.query(
      `ALTER TABLE "periodo_trabajo" ADD "horasPeriodo" numeric(10,2)`
    );
    await queryRunner.query(
      `ALTER TABLE "periodo_trabajo" ADD "precioHoraPeriodo" numeric(10,2)`
    );
    // (CHECK opcional de modalidad, por claridad de la BD)
    await queryRunner.query(
      `ALTER TABLE "trabajo" ADD CONSTRAINT "CHK_trabajo_modalidadCobro" CHECK ("modalidadCobro" IN ('fijo','horas_fijas','horas_variables','por_tarea'))`
    );
    await queryRunner.query(
      `CREATE TABLE "tarea_trabajo" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fechaCarga" TIMESTAMPTZ NOT NULL, "fechaHoraTarea" TIMESTAMPTZ NOT NULL, "descripcion" character varying, "horasTarea" numeric(10,2), "montoTarea" numeric(10,2) NOT NULL DEFAULT '0', "eliminado" boolean NOT NULL DEFAULT false, "periodoTrabajoId" integer, CONSTRAINT "PK_tarea_trabajo" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "tarea_trabajo" ADD CONSTRAINT "FK_tarea_trabajo_periodoTrabajo" FOREIGN KEY ("periodoTrabajoId") REFERENCES "periodo_trabajo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tarea_trabajo" DROP CONSTRAINT "FK_tarea_trabajo_periodoTrabajo"`
    );
    await queryRunner.query(`DROP TABLE "tarea_trabajo"`);
    await queryRunner.query(
      `ALTER TABLE "trabajo" DROP CONSTRAINT "CHK_trabajo_modalidadCobro"`
    );
    await queryRunner.query(
      `ALTER TABLE "periodo_trabajo" DROP COLUMN "precioHoraPeriodo"`
    );
    await queryRunner.query(
      `ALTER TABLE "periodo_trabajo" DROP COLUMN "horasPeriodo"`
    );
    await queryRunner.query(`ALTER TABLE "trabajo" DROP COLUMN "modalidadCobro"`);
  }
}
