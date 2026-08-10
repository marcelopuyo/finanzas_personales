import { MigrationInterface, QueryRunner } from "typeorm";

// Vincula el depósito de propina con su jornada: `movimiento.jornadaId`
// (FK nullable a jornada_trabajo). Se setea en `cargarJornadaTrabajo` cuando
// hay propina, para que al borrar la jornada (eliminarJornadaTrabajo) se pueda
// localizar y revertir el movimiento "Cobro Propina" de forma confiable.
export class AddMovimientoJornada1786310000001 implements MigrationInterface {
    name = 'AddMovimientoJornada1786310000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movimiento" ADD "jornadaTrabajoId" uuid`);
        await queryRunner.query(`ALTER TABLE "movimiento" ADD CONSTRAINT "FK_movimiento_jornada_trabajo" FOREIGN KEY ("jornadaTrabajoId") REFERENCES "jornada_trabajo"("id") ON DELETE SET NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movimiento" DROP CONSTRAINT "FK_movimiento_jornada_trabajo"`);
        await queryRunner.query(`ALTER TABLE "movimiento" DROP COLUMN "jornadaTrabajoId"`);
    }
}
