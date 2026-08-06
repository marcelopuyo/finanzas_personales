import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Tarjeta } from "./tarjeta.entity";

// Relación propietaria tarjeta. La inversa OneToMany (movimientos) se omite
// para evitar ciclos; el lado propietario (MovimientoTarjeta.periodo) basta.
@Entity({ name: "periodo_tarjeta" })
export class PeriodoTarjeta {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nombre: string;

  @Column({ type: "date" })
  fechaApertura: Date;

  @Column({ type: "date" })
  fechaCierre: Date;

  @Column({ type: "date" })
  fechaVencimiento: Date;

  @Column({
    default: false,
  })
  eliminado: boolean;

  @ManyToOne(() => Tarjeta, { onDelete: "SET NULL" })
  tarjeta: Tarjeta;
}
