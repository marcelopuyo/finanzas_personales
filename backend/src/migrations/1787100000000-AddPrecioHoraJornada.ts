import { MigrationInterface, QueryRunner } from "typeorm";

// Agrega `jornada_trabajo.precioHora` (numeric): snapshot del precio por hora
// del trabajo AL MOMENTO DE LA CARGA de la jornada. Al editar una jornada se
// usa ESTE precio (no el actual del trabajo) para recalcular el monto de la
// jornada y, con él, el monto a cobrar del período → se preserva el valor
// histórico aunque el precio por hora del trabajo cambie después.
//
// Backfill: reconstruye el precio de cada jornada existente a partir de su
// `montoJornada` y las horas trabajadas (inversa de calcularMontoJornada:
// precio = round(monto / horas, 2)); si la jornada no tiene horas
// (horaDesde == horaHasta), usa el precio actual del trabajo. NO modifica
// montos existentes: solo agrega el snapshot.
export class AddPrecioHoraJornada1787100000000 implements MigrationInterface {
  name = "AddPrecioHoraJornada1787100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "jornada_trabajo" ADD "precioHora" numeric(10,2)`
    );
    // Backfill del snapshot. (Nota: la tabla destino `jt` NO puede referenciarse
    // dentro de los JOIN del FROM en un UPDATE; por eso `periodoTrabajoId` va en
    // el CTE `calc` y los JOIN usan solo `c`/`pt`/`t`.)
    await queryRunner.query(`
      WITH calc AS (
        SELECT
          jt.id,
          jt."periodoTrabajoId",
          ((jt."horaHasta" - FLOOR(jt."horaHasta")) * 100 / 60 + FLOOR(jt."horaHasta"))
          - ((jt."horaDesde" - FLOOR(jt."horaDesde")) * 100 / 60 + FLOOR(jt."horaDesde")) AS horas
        FROM "jornada_trabajo" jt
      )
      UPDATE "jornada_trabajo" jt
      SET "precioHora" = CASE
        WHEN c.horas > 0 THEN ROUND(jt."montoJornada" / c.horas, 2)
        ELSE t."precioHora"
      END
      FROM calc c
      JOIN "periodo_trabajo" pt ON pt.id = c."periodoTrabajoId"
      JOIN "trabajo" t ON t.id = pt."trabajoId"
      WHERE c.id = jt.id
    `);
    await queryRunner.query(
      `ALTER TABLE "jornada_trabajo" ALTER COLUMN "precioHora" SET DEFAULT 0`
    );
    await queryRunner.query(
      `ALTER TABLE "jornada_trabajo" ALTER COLUMN "precioHora" SET NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "jornada_trabajo" DROP COLUMN "precioHora"`
    );
  }
}
