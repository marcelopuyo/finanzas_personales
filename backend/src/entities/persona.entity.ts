import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { Usuario } from "./usuario.entity";

// Port 1:1 del backend NestJS. Relaciones a MovimientoTarjeta/Prestamo se
// agregan cuando se migren esos módulos (Fases 4 y 6).
// El nombre es único POR USUARIO (no global): 2 usuarios pueden crear una
// persona con el mismo nombre, pero un mismo usuario no puede repetirlo.
@Entity({ name: "persona" })
@Unique(["nombre", "usuario"])
export class Persona {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  @Column({ nullable: true })
  telefono?: string;

  @Column({ nullable: true })
  mail?: string;

  @Column({
    default: false,
  })
  eliminado: boolean;

  @ManyToOne(() => Usuario, { onDelete: "CASCADE", nullable: false })
  usuario: Usuario;
}
