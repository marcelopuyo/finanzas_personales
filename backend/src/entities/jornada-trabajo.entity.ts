import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { PeriodoTrabajo } from "./periodo-trabajo.entity";

@Entity({ name: "jornada_trabajo" })
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

  @ManyToOne(() => PeriodoTrabajo)
  periodoTrabajo: PeriodoTrabajo;
}
