import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Concepto } from "./concepto.entity";
import { Cuenta } from "./cuenta.entity";
import { Gasto } from "./gasto.entity";
import { Prestamo } from "./prestamo.entity";
import { PeriodoTrabajo } from "./periodo-trabajo.entity";
import { JornadaTrabajo } from "./jornada-trabajo.entity";

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

  /** Monto real en la moneda de la cuenta (el delta que aplica al saldo).
   * `monto` queda en la moneda predeterminada del usuario (convertido).
   * Se guarda para que reversiones e historial no dependan de tasa histórica. */
  @Column({ type: "numeric", precision: 10, scale: 2 })
  montoCuentaMonedaOrigen: number;

  @Column({
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

  /** Id de agrupación: los 2 movimientos de una transferencia comparten el
   * mismo grupoId para poder revertirlos juntos (y solo juntos). Null en el
   * resto de los movimientos. */
  @Column({ type: "uuid", nullable: true })
  grupoId?: string | null;

  /** Período de trabajo cobrado (solo movimientos "Cobro Sueldo"). Se usa al
   * revertir el cobro para limpiar el fechaDeCobro del período exacto. */
  @ManyToOne(() => PeriodoTrabajo, { nullable: true })
  periodoTrabajo?: PeriodoTrabajo | null;

  /** Jornada que originó el depósito de propina (solo movimientos
   * "Cobro Propina"). Se usa al borrar la jornada para revertir el depósito. */
  @ManyToOne(() => JornadaTrabajo, { nullable: true })
  jornadaTrabajo?: JornadaTrabajo | null;
}
