import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Concepto } from "./concepto.entity";
import { Cuenta } from "./cuenta.entity";
import { Gasto } from "./gasto.entity";
import { Prestamo } from "./prestamo.entity";

// Relaciones propietarias (ManyToOne). Las inversas se omiten por estar ya
// eliminadas en los demás módulos (evita ciclos de importación).
@Entity({ name: "movimiento" })
export class Movimiento {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "date" })
  fecha: Date;

  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  monto: number;

  @Column({
    type: "bit",
    default: false,
  })
  eliminado: boolean;

  @ManyToOne(() => Concepto)
  concepto?: Concepto;

  @ManyToOne(() => Cuenta, { onDelete: "CASCADE" })
  cuenta: Cuenta;

  @ManyToOne(() => Prestamo)
  prestamo?: Prestamo;

  @ManyToOne(() => Gasto)
  gasto?: Gasto;
}
