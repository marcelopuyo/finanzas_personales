import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Tarjeta } from "./tarjeta.entity";
import { Persona } from "./persona.entity";
import { PeriodoTarjeta } from "./periodo-tarjeta.entity";

@Entity({ name: "movimiento_tarjeta" })
export class MovimientoTarjeta {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  detalle: string;

  @Column({ type: "date" })
  fecha: Date;

  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  monto: number;

  @Column({ type: "int" })
  cuotas: number;

  @Column({
    default: false,
  })
  eliminado: boolean;

  // Relaciones propietarias (ManyToOne). Las inversas se omiten para evitar ciclos.
  @ManyToOne(() => Tarjeta, { onDelete: "CASCADE" })
  tarjeta?: Tarjeta;

  @ManyToOne(() => Persona, { onDelete: "CASCADE" })
  persona: Persona;

  @ManyToOne(() => PeriodoTarjeta, { onDelete: "CASCADE" })
  periodo: PeriodoTarjeta;
}
