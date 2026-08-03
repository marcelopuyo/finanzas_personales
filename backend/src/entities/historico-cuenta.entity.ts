import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Cuenta } from "./cuenta.entity";

@Entity({ name: "historico_cuenta" })
export class HistoricoCuenta {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "datetime" })
  fechaDesde: Date;

  @Column({ type: "datetime", nullable: true })
  fechaHasta?: Date;

  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  saldo: number;

  @Column({
    type: "bit",
    default: false,
  })
  eliminado: boolean;

  @ManyToOne(() => Cuenta, {
    onDelete: "CASCADE",
  })
  cuenta?: Cuenta;
}
