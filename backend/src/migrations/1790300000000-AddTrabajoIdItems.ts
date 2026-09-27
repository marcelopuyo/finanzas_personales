import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * **`trabajoId` en los ítems** (jornadas y tareas) — rebanada R2 de `DeepSeek/plan-liquidaciones.md`.
 *
 * En el modelo nuevo el ítem **ya no cuelga de un período**: nace **pendiente**
 * (`periodoTrabajoId = NULL`) y el período existe recién cuando se cobra. Hasta ahora el
 * trabajo al que pertenecía un ítem se **deducía** del período ⇒ un ítem pendiente quedaba
 * huérfano (sin trabajo). Esta migración agrega el vínculo **directo**.
 *
 * 1. `jornada_trabajo.trabajoId` y `tarea_trabajo.trabajoId` (integer, nullable).
 * 2. **Backfill** de las filas históricas desde su período (`periodo_trabajo.trabajoId`).
 * 3. Índices **parciales** para la consulta "ítems pendientes de este trabajo"
 *    (`trabajoId = X AND periodoTrabajoId IS NULL`), que usa la pantalla de cobro.
 * 4. FK a `trabajo` con `ON DELETE CASCADE` (misma semántica que `trabajo.usuarioId`).
 *
 * Rollback (down): borra las FK, los índices y las columnas (el backfill no se revierte por fila).
 */
export class AddTrabajoIdItems1790300000000 implements MigrationInterface {
  name = "AddTrabajoIdItems1790300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "jornada_trabajo" ADD "trabajoId" integer`
    );
    await queryRunner.query(
      `ALTER TABLE "tarea_trabajo" ADD "trabajoId" integer`
    );

    // Backfill desde el período (los históricos siempre tienen período).
    await queryRunner.query(
      `UPDATE "jornada_trabajo" j
          SET "trabajoId" = pt."trabajoId"
         FROM "periodo_trabajo" pt
        WHERE j."periodoTrabajoId" = pt.id AND j."trabajoId" IS NULL`
    );
    await queryRunner.query(
      `UPDATE "tarea_trabajo" t
          SET "trabajoId" = pt."trabajoId"
         FROM "periodo_trabajo" pt
        WHERE t."periodoTrabajoId" = pt.id AND t."trabajoId" IS NULL`
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_jornada_trabajo_pendientes_trabajo" ON "jornada_trabajo" ("trabajoId") WHERE "periodoTrabajoId" IS NULL`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tarea_trabajo_pendientes_trabajo" ON "tarea_trabajo" ("trabajoId") WHERE "periodoTrabajoId" IS NULL`
    );

    await queryRunner.query(
      `ALTER TABLE "jornada_trabajo" ADD CONSTRAINT "FK_jornada_trabajo_trabajo" FOREIGN KEY ("trabajoId") REFERENCES "trabajo"(id) ON DELETE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "tarea_trabajo" ADD CONSTRAINT "FK_tarea_trabajo_trabajo" FOREIGN KEY ("trabajoId") REFERENCES "trabajo"(id) ON DELETE CASCADE`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tarea_trabajo" DROP CONSTRAINT "FK_tarea_trabajo_trabajo"`
    );
    await queryRunner.query(
      `ALTER TABLE "jornada_trabajo" DROP CONSTRAINT "FK_jornada_trabajo_trabajo"`
    );
    await queryRunner.query(
      `DROP INDEX "IDX_tarea_trabajo_pendientes_trabajo"`
    );
    await queryRunner.query(
      `DROP INDEX "IDX_jornada_trabajo_pendientes_trabajo"`
    );
    await queryRunner.query(
      `ALTER TABLE "tarea_trabajo" DROP COLUMN "trabajoId"`
    );
    await queryRunner.query(
      `ALTER TABLE "jornada_trabajo" DROP COLUMN "trabajoId"`
    );
  }
}
