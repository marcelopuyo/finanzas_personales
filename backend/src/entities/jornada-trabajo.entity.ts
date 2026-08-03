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

  @Column({
    type: "bit",
    default: false,
  })
  eliminado: boolean;

  @ManyToOne(() => PeriodoTrabajo)
  periodoTrabajo: PeriodoTrabajo;
}
