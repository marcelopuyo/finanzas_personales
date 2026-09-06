import { MigrationInterface, QueryRunner } from "typeorm";

// Tareas "por fecha local del usuario" (2026-09-05):
//  - Nueva columna `tarea_trabajo.fechaTarea` (date): la FECHA CALENDARIO LOCAL
//    que eligió el usuario al cargar la tarea. Se guarda como `date` (sin zona),
//    igual que el resto de las fechas del sistema (fechaJornada, períodos), para
//    agrupar/validar SIN ambigüedad de zona horaria. `fechaHoraTarea` (timestamptz)
//    conserva el instante exacto (para mostrar la hora local).
// Backfill: se deduce de `fechaHoraTarea` usando la zona del usuario
// (America/Argentina/Buenos_Aires). Afecta solo a filas existentes en dev (QA);
// en prod `tarea_trabajo` aún no existe (la feature no se desplegó).
export class AddFechaTareaTarea1789000000100 implements MigrationInterface {
  name = "AddFechaTareaTarea1789000000100";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tarea_trabajo" ADD "fechaTarea" date`
    );
    // Deduce la fecha local de las filas existentes (madrugada GMT-3 → día local).
    await queryRunner.query(
      `UPDATE "tarea_trabajo"
          SET "fechaTarea" = ("fechaHoraTarea" AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
        WHERE "fechaTarea" IS NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "tarea_trabajo" ALTER COLUMN "fechaTarea" SET NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tarea_trabajo" DROP COLUMN "fechaTarea"`);
  }
}
