import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

// Port 1:1 desde el backend NestJS (finanzas-personales/src/maestros/entities/concepto.entity.ts)
// Relaciones (OneToMany a Movimiento, Gasto, etc.) se agregan cuando se migren esas entidades.
//
// Tabla GLOBAL/compartida (NO multiusuario): todos los usuarios ven los mismos
// conceptos. Su CRUD está restringido a administradores (ver requireAdmin()).
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
