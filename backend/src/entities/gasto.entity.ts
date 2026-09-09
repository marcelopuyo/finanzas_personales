import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { CategoriaGasto } from "./categoria-gasto.entity";
import { Usuario } from "./usuario.entity";

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

  @ManyToOne(() => CategoriaGasto)
  categoria: CategoriaGasto;

  @ManyToOne(() => Usuario, { onDelete: "CASCADE", nullable: false })
  usuario: Usuario;
}
