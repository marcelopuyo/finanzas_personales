import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { Cuenta } from "./cuenta.entity";
import { Usuario } from "./usuario.entity";

// Lado propietario de la relación OneToOne con Cuenta (crea columna cuentaId).
// Las relaciones inversas (movimientos/periodos) se omiten para evitar ciclos.
// El nombre es único POR USUARIO (no global).
@Entity({ name: "tarjeta" })
@Unique(["nombre", "usuario"])
export class Tarjeta {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
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

  @ManyToOne(() => Usuario, { onDelete: "CASCADE", nullable: false })
  usuario: Usuario;
}
