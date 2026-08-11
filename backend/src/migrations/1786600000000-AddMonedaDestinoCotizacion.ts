import { MigrationInterface, QueryRunner } from "typeorm";

// `cotizacion` pasa a relacionar DOS monedas (origen → destino) con su tasa:
//   1. Se vacía la tabla (no había cotizaciones; nada que preservar).
//   2. `monedaId` se renombra a `monedaOrigenId` (misma semántica que destino).
//   3. Se agrega `monedaDestinoId` (FK, NOT NULL).
//   4. `usuarioId` pasa a nullable: las filas de la API son GLOBALES
//      (compartidas entre usuarios; no hay cotizaciones manuales).
//   5. `cotizacion` → numeric(18,8) (precisión suficiente para el inverso 1/tasa).
//   6. Índices: expresión única por (origen, destino, fechaInicial,
//      COALESCE(fechaFinal,'infinity')) + parcial único por par vigente
//      (fechaFinal IS NULL → una sola cotización abierta por par).
export class AddMonedaDestinoCotizacion1786600000000 implements MigrationInterface {
    name = 'AddMonedaDestinoCotizacion1786600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1) Vaciar (la tabla está vacía; no se preserva nada).
        await queryRunner.query(`DELETE FROM "cotizacion"`);

        // 2) Renombrar monedaId -> monedaOrigenId (PG actualiza la FK automáticamente).
        await queryRunner.query(`ALTER TABLE "cotizacion" RENAME COLUMN "monedaId" TO "monedaOrigenId"`);

        // 3) Moneda destino.
        await queryRunner.query(`ALTER TABLE "cotizacion" ADD "monedaDestinoId" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "cotizacion" ADD CONSTRAINT "FK_cotizacion_moneda_destino" FOREIGN KEY ("monedaDestinoId") REFERENCES "moneda"("id")`);

        // 4) Global: usuarioId nullable.
        await queryRunner.query(`ALTER TABLE "cotizacion" ALTER COLUMN "usuarioId" DROP NOT NULL`);

        // 5) Precisión de la tasa.
        await queryRunner.query(`ALTER TABLE "cotizacion" ALTER COLUMN "cotizacion" TYPE numeric(18,8)`);

        // 6) Índices.
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_cotizacion_par_dia" ON "cotizacion" ("monedaOrigenId", "monedaDestinoId", "fechaInicial", COALESCE("fechaFinal", 'infinity'::date))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_cotizacion_par_vigente" ON "cotizacion" ("monedaOrigenId", "monedaDestinoId") WHERE "fechaFinal" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "UQ_cotizacion_par_vigente"`);
        await queryRunner.query(`DROP INDEX "UQ_cotizacion_par_dia"`);
        await queryRunner.query(`ALTER TABLE "cotizacion" ALTER COLUMN "cotizacion" TYPE numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "cotizacion" ALTER COLUMN "usuarioId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "cotizacion" DROP CONSTRAINT "FK_cotizacion_moneda_destino"`);
        await queryRunner.query(`ALTER TABLE "cotizacion" DROP COLUMN "monedaDestinoId"`);
        await queryRunner.query(`ALTER TABLE "cotizacion" RENAME COLUMN "monedaOrigenId" TO "monedaId"`);
    }
}
