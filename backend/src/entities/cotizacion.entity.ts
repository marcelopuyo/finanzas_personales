import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Moneda } from "./moneda.entity";

@Entity({ name: "cotizacion" })
export class Cotizacion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "date" })
  fechaInicial: Date;

  @Column({ type: "date" })
  fechaFinal: Date;

  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  cotizacion: number;

  @Column({
    default: false,
  })
  eliminado: boolean;

  @ManyToOne(() => Moneda, {
    onDelete: "CASCADE",
  })
  moneda: Moneda;
}
