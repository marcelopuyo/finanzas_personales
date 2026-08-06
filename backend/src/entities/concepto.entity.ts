import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Usuario } from "./usuario.entity";

// Port 1:1 desde el backend NestJS (finanzas-personales/src/maestros/entities/concepto.entity.ts)
// Relaciones (OneToMany a Movimiento, Gasto, etc.) se agregan cuando se migren esas entidades.
@Entity({ name: "concepto" })
export class Concepto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nombre: string;

  // Los conceptos del sistema (compartidos entre todos los usuarios) tienen
  // `sistema = true` y `usuarioId` NULL. Los que crea un usuario llevan su id.
  @Column({ default: false })
  sistema: boolean;

  @Column({
    default: false,
  })
  eliminado: boolean;

  // Ingreso / Egreso
  @Column({ default: null })
  categoria?: string;

  @ManyToOne(() => Usuario, { onDelete: "CASCADE" })
  usuario?: Usuario;
}
