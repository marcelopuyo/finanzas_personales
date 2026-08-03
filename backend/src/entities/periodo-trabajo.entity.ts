import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Trabajo } from "./trabajo.entity";
// import type rompe el ciclo en runtime con jornada-trabajo (string target)
import type { JornadaTrabajo } from "./jornada-trabajo.entity";

@Entity({ name: "periodo_trabajo" })
export class PeriodoTrabajo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "date" })
  fechaDesde: Date;

  @Column({ type: "date" })
  fechaHasta: Date;

  @Column({
    type: "numeric",
    precision: 10,
    scale: 2,
    default: 0,
    nullable: true,
  })
  montoACobrar?: number;

  @Column({ type: "date", nullable: true })
  fechaEstimadaCobro?: Date;

  @Column({ type: "date", nullable: true })
  fechaDeCobro?: Date;

  @Column({
    type: "bit",
    default: false,
  })
  eliminado: boolean;

  @ManyToOne(() => Trabajo)
  trabajo: Trabajo;

  // Relación inversa con STRING TARGET (evita import circular en runtime con
  // JornadaTrabajo). El lado propietario está en jornada-trabajo.entity.
  @OneToMany("JornadaTrabajo", (jornada: JornadaTrabajo) => jornada.periodoTrabajo, {
    cascade: true,
    eager: false,
  })
  jornadas?: JornadaTrabajo[];
}
