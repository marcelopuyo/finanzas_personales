import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Cuenta } from "./cuenta.entity";

// Lado propietario de la relación OneToOne con Cuenta (crea columna cuentaId).
// Las relaciones inversas (movimientos/periodos) se omiten para evitar ciclos.
@Entity({ name: "tarjeta" })
export class Tarjeta {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nombre: string;

  @Column()
  banco: string;

  @Column()
  numero: string;

  @Column({
    default: false,
  })
  eliminado: boolean;

  @OneToOne(() => Cuenta, { onDelete: "CASCADE" })
  @JoinColumn()
  cuenta: Cuenta;
}
