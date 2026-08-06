import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Persona } from "./persona.entity";
import { Cuenta } from "./cuenta.entity";
import { Usuario } from "./usuario.entity";

@Entity({ name: "prestamo" })
export class Prestamo {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  detalle: string;

  @Column({ type: "date" })
  fecha: Date;

  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  monto: number;

  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  saldo: number;

  @Column({ type: "int" })
  cuotas: number;

  @Column()
  sentido: string;

  @Column({
    default: false,
  })
  eliminado: boolean;

  // Relaciones propietarias (ManyToOne). Las relaciones OneToOne a
  // Movimiento/MovimientoTarjeta y la inversa movimientosCobros se agregan
  // cuando se migren/necesiten esos módulos.
  @ManyToOne(() => Persona)
  personaOrigen: Persona;

  @ManyToOne(() => Persona)
  personaDestino: Persona;

  @ManyToOne(() => Cuenta, { onDelete: "CASCADE" })
  cuenta: Cuenta;

  @ManyToOne(() => Usuario, { onDelete: "CASCADE", nullable: false })
  usuario: Usuario;
}
