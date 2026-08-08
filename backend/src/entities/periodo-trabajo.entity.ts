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
    default: false,
  })
  eliminado: boolean;

  @ManyToOne(() => Trabajo)
  trabajo: Trabajo;

  // Relación inversa con STRING TARGET = NOMBRE DE TABLA ("jornada_trabajo"),
  // no el nombre de clase: evita import circular en runtime con JornadaTrabajo
  // y sobrevive la minificación de Turbopack en producción (los nombres de
  // clase se manglean y `@OneToMany("JornadaTrabajo")` deja de resolver el
  // target → EntityMetadataNotFoundError). El lado propietario está en
  // jornada-trabajo.entity.
  @OneToMany("jornada_trabajo", (jornada: JornadaTrabajo) => jornada.periodoTrabajo, {
    cascade: true,
    eager: false,
  })
  jornadas?: JornadaTrabajo[];
}
