import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * **Rediseño "períodos gestionados" → "liquidaciones"** (Fase 1 de `DeepSeek/plan-liquidaciones.md`).
 *
 * La entidad ya no es un *plan* que el usuario mantiene, sino una **liquidación** que nace en el
 * acto de cobrar. Esta migración sólo hace **DDL**: los datos los completa
 * `backend/scripts/backfill-liquidaciones.mjs` (idempotente, con reporte).
 *
 * 1. `periodo_trabajo.montoACobrar` → **`montoCalculado`** (rename puro: los valores NO se mueven).
 *    Pasa a significar *"lo que correspondía cobrar"*: Σ de los ítems seleccionados, `horas × precio`
 *    o —en modalidad `fijo`— una copia del cobrado.
 * 2. `periodo_trabajo.montoCobrado` (numeric, nullable): **lo que realmente entró**. Lo escribe el
 *    cobro con el MISMO número que `movimiento.montoCuentaMonedaOrigen` (**nominal**, no el convertido
 *    a moneda predeterminada) y dentro de la misma transacción. Queda `NULL` en las filas históricas
 *    hasta que corra el script de backfill.
 * 3. **Índices parciales de pendientes**: la tarjeta "Por cobrar" y la selección del cobro consultan
 *    `WHERE "periodoTrabajoId" IS NULL` en cada carga, y sobre esa FK **no había ningún índice**.
 *    Parciales (`WHERE ... IS NULL`) para no engordar el índice con las filas ya liquidadas.
 *
 * ⚠️ **La tabla NO se renombra** (decisión P9): `periodo_trabajo` y las FK `periodoTrabajoId`
 * conservan el nombre histórico — sólo cambian los nombres **a nivel de código**
 * (clase `Liquidacion`). El motivo está documentado en `periodo-trabajo.entity.ts`.
 *
 * Rollback (down): borra los índices, borra la columna nueva y renombra la columna de vuelta.
 * ⚠️ El `down` **no** reconstruye la disolución de los 9 períodos sin cobrar que hace el script
 * (esos ítems quedan pendientes y sus filas soft-deleted): si hiciera falta volver atrás, hay que
 * re-vincularlos a mano con el informe que imprime el script.
 */
export class AddMontoCobradoLiquidacion1790200000000 implements MigrationInterface {
  name = "AddMontoCobradoLiquidacion1790200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "periodo_trabajo" RENAME COLUMN "montoACobrar" TO "montoCalculado"`
    );
    await queryRunner.query(
      `ALTER TABLE "periodo_trabajo" ADD "montoCobrado" numeric(10,2)`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_jornada_trabajo_pendiente" ON "jornada_trabajo" ("periodoTrabajoId") WHERE "periodoTrabajoId" IS NULL`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tarea_trabajo_pendiente" ON "tarea_trabajo" ("periodoTrabajoId") WHERE "periodoTrabajoId" IS NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_tarea_trabajo_pendiente"`);
    await queryRunner.query(`DROP INDEX "IDX_jornada_trabajo_pendiente"`);
    await queryRunner.query(
      `ALTER TABLE "periodo_trabajo" DROP COLUMN "montoCobrado"`
    );
    await queryRunner.query(
      `ALTER TABLE "periodo_trabajo" RENAME COLUMN "montoCalculado" TO "montoACobrar"`
    );
  }
}
