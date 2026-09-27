import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Liquidacion } from "./periodo-trabajo.entity";
import { Trabajo } from "./trabajo.entity";

@Entity({ name: "jornada_trabajo" })
// Índice **parcial** de pendientes de liquidar (plan-liquidaciones.md): la tarjeta "Por cobrar" y la
// selección del cobro filtran `periodoTrabajoId IS NULL` en cada carga y no había ningún índice.
@Index("IDX_jornada_trabajo_pendiente", ["periodoTrabajo"], {
  where: '"periodoTrabajoId" IS NULL',
})
// Índice **parcial** de "pendientes de ESTE trabajo": es la consulta de la pantalla de cobro.
@Index("IDX_jornada_trabajo_pendientes_trabajo", ["trabajo"], {
  where: '"periodoTrabajoId" IS NULL',
})
export class JornadaTrabajo {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "date" })
  fechaJornada: Date;

  @Column({ type: "date" })
  fechaCarga: Date;

  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  horaDesde: number;

  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  horaHasta: number;

  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  montoJornada: number;

  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  montoPropina: number = 0;

  // Precio por hora del trabajo AL MOMENTO DE LA CARGA (snapshot). Al editar la
  // jornada se usa este precio para recalcular el monto (NO el precio actual del
  // trabajo), preservando el valor histórico del período.
  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  precioHora: number;

  @Column({
    default: false,
  })
  eliminado: boolean;

  // ⚠️ **En el modelo nuevo la columna es NULLABLE**: `NULL` ⇒ **pendiente de liquidar** (la
  // liquidación se crea recién al cobrar y le asigna los ítems). El tipo TS se relaja en la Fase 2.
  @ManyToOne(() => Liquidacion, { nullable: true })
  periodoTrabajo: Liquidacion;

  /**
   * Trabajo al que pertenece la jornada. En el modelo nuevo es el **único vínculo
   * permanente**: el ítem puede estar pendiente (sin período) y el trabajo se necesita
   * para listarlo y liquidarlo. Se completa siempre al crear la jornada.
   */
  @ManyToOne(() => Trabajo, { nullable: true, onDelete: "CASCADE" })
  trabajo?: Trabajo;
}
