import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Usuario } from "./usuario.entity";

// Port 1:1 del backend NestJS. Relaciones a MovimientoTarjeta/Prestamo se
// agregan cuando se migren esos módulos (Fases 4 y 6).
@Entity({ name: "persona" })
export class Persona {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
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
