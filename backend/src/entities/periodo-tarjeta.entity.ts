import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { Tarjeta } from "./tarjeta.entity";

// Relación propietaria tarjeta. La inversa OneToMany (movimientos) se omite
// para evitar ciclos; el lado propietario (MovimientoTarjeta.periodo) basta.
// El nombre es único POR TARJETA (cada tarjeta pertenece a un usuario, así el
// mismo nombre puede repetirse entre tarjetas/usuarios distintos, no global).
@Entity({ name: "periodo_tarjeta" })
@Unique(["nombre", "tarjeta"])
export class PeriodoTarjeta {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
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
