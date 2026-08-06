import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

// Port 1:1 desde el backend NestJS (finanzas-personales/src/maestros/entities/concepto.entity.ts)
// Relaciones (OneToMany a Movimiento, Gasto, etc.) se agregan cuando se migren esas entidades.
@Entity({ name: "concepto" })
export class Concepto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nombre: string;

  @Column({
    default: false,
  })
  eliminado: boolean;

  // Ingreso / Egreso
  @Column({ default: null })
  categoria?: string;
}
