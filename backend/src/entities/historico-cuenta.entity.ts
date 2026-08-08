import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Cuenta } from "./cuenta.entity";
import type { Movimiento } from "./movimiento.entity";

@Entity({ name: "historico_cuenta" })
export class HistoricoCuenta {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  fechaDesde: Date;

  @Column({ nullable: true })
  fechaHasta?: Date;

  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  saldo: number;

  @Column({
    default: false,
  })
  eliminado: boolean;

  @ManyToOne(() => Cuenta, {
    onDelete: "CASCADE",
  })
  cuenta?: Cuenta;

  /** Relación 1:1 con el movimiento que originó este registro. Nula para
   * históricos iniciales o de reversión (eliminarGasto).
   * Se usa el NOMBRE DE TABLA ("movimiento") en vez del nombre de clase:
   * Turbopack minifica los nombres de clase en producción y
   * `@OneToOne("Movimiento")` deja de resolver el target
   * (EntityMetadataNotFoundError "s#movimiento"). El nombre de tabla es
   * estable (givenTableName), por eso sí resuelve. */
  @OneToOne("movimiento", { nullable: true })
  @JoinColumn()
  movimiento?: Movimiento | null;
}
