import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Préstamos: una sola persona (la CONTRAPARTE) en lugar de `personaOrigen` +
 * `personaDestino`, y sin `cuotas` (no se usaba).
 *
 * La otra parte de un préstamo es SIEMPRE el usuario de la app, así que sólo se
 * guarda la contraparte; su rol (Prestador/Destinatario) se deriva de `sentido`.
 *
 * Pasos:
 *  1. Nueva columna `personaContraparteId` (int, nullable al principio).
 *  2. Backfill: la contraparte es el "otro" lado según el sentido
 *     (`otorgado` → personaDestino; `obtenido` → personaOrigen).
 *  3. NOT NULL + FK a `persona` + índice.
 *  4. CHECK de `sentido` (otorgado | obtenido).
 *  5. DROP de `personaOrigenId`, `personaDestinoId` y `cuotas`.
 *
 * Rollback (down): recrea las 2 columnas y `cuotas`, copiando la contraparte a
 * los dos lados (no se puede reconstruir cuál era el usuario): es PARCIAL.
 *
 * Plan detallado: `DeepSeek/plan-prestamos-persona-unica.md` (§5).
 */
export class PrestamoPersonaUnica1789700000000 implements MigrationInterface {
  name = "PrestamoPersonaUnica1789700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Columna nueva (nullable primero, para poder backfillear).
    await queryRunner.query(
      `ALTER TABLE "prestamo" ADD "personaContraparteId" integer`
    );

    // 2) Backfill: el "otro" lado del préstamo es la contraparte.
    await queryRunner.query(
      `UPDATE "prestamo"
         SET "personaContraparteId" = CASE
           WHEN sentido = 'otorgado' THEN COALESCE("personaDestinoId", "personaOrigenId")
           ELSE COALESCE("personaOrigenId", "personaDestinoId")
         END`
    );

    // 3) NOT NULL + FK + índice.
    await queryRunner.query(
      `ALTER TABLE "prestamo" ALTER COLUMN "personaContraparteId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "prestamo" ADD CONSTRAINT "FK_prestamo_persona_contraparte"
         FOREIGN KEY ("personaContraparteId") REFERENCES "persona"("id")
         ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_prestamo_persona_contraparte" ON "prestamo" ("personaContraparteId")`
    );

    // 4) CHECK del sentido (mismos valores que valida el schema zod).
    await queryRunner.query(
      `ALTER TABLE "prestamo" ADD CONSTRAINT "CHK_prestamo_sentido"
         CHECK (sentido IN ('otorgado', 'obtenido'))`
    );

    // 5) Drops de las columnas que dejan de existir.
    await queryRunner.query(
      `ALTER TABLE "prestamo" DROP CONSTRAINT "FK_c0e5514e8a66068e62c449f09ca"`
    );
    await queryRunner.query(
      `ALTER TABLE "prestamo" DROP CONSTRAINT "FK_e51927df7041eed8151b4aba184"`
    );
    await queryRunner.query(
      `ALTER TABLE "prestamo" DROP COLUMN "personaOrigenId"`
    );
    await queryRunner.query(
      `ALTER TABLE "prestamo" DROP COLUMN "personaDestinoId"`
    );
    await queryRunner.query(`ALTER TABLE "prestamo" DROP COLUMN "cuotas"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reversión PARCIAL: la contraparte se copia a los dos lados.
    await queryRunner.query(
      `ALTER TABLE "prestamo" ADD "cuotas" integer NOT NULL DEFAULT 1`
    );
    await queryRunner.query(
      `ALTER TABLE "prestamo" ALTER COLUMN "cuotas" DROP DEFAULT`
    );
    await queryRunner.query(`ALTER TABLE "prestamo" ADD "personaOrigenId" integer`);
    await queryRunner.query(
      `ALTER TABLE "prestamo" ADD "personaDestinoId" integer`
    );
    await queryRunner.query(
      `UPDATE "prestamo"
         SET "personaOrigenId" = "personaContraparteId",
             "personaDestinoId" = "personaContraparteId"`
    );
    await queryRunner.query(
      `ALTER TABLE "prestamo" ADD CONSTRAINT "FK_c0e5514e8a66068e62c449f09ca"
         FOREIGN KEY ("personaOrigenId") REFERENCES "persona"("id")
         ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "prestamo" ADD CONSTRAINT "FK_e51927df7041eed8151b4aba184"
         FOREIGN KEY ("personaDestinoId") REFERENCES "persona"("id")
         ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(`DROP INDEX "IDX_prestamo_persona_contraparte"`);
    await queryRunner.query(
      `ALTER TABLE "prestamo" DROP CONSTRAINT "CHK_prestamo_sentido"`
    );
    await queryRunner.query(
      `ALTER TABLE "prestamo" DROP CONSTRAINT "FK_prestamo_persona_contraparte"`
    );
    await queryRunner.query(
      `ALTER TABLE "prestamo" DROP COLUMN "personaContraparteId"`
    );
  }
}
