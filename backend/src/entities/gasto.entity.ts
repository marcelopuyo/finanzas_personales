import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { PeriodoGasto } from "./periodo-gasto.entity";
import { CategoriaGasto } from "./categoria-gasto.entity";

@Entity({ name: "gasto" })
export class Gasto {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ default: null })
  descripcion: string;

  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  monto: number;

  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  saldo: number;

  @Column({ type: "date", nullable: true })
  fechaVencimiento?: Date;

  @Column({ type: "date", nullable: true })
  fechaPago?: Date;

  @Column({ default: false })
  isPeriodico: boolean;

  @Column({
    default: false,
  })
  eliminado: boolean;

  // Lado propietario (ManyToOne). La relación inversa (movimientos) se agrega
  // al migrar el módulo de movimientos (Fase 7).
  @ManyToOne(() => PeriodoGasto)
  periodo: PeriodoGasto;

  @ManyToOne(() => CategoriaGasto)
  categoria: CategoriaGasto;
}
