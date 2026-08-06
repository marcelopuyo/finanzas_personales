import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Usuario } from "./usuario.entity";

@Entity({ name: "inflacion" })
export class Inflacion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "date" })
  fechaInicial: Date;

  @Column({ type: "date" })
  fechaFinal: Date;

  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  indice: number;

  @Column({
    default: false,
  })
  eliminado: boolean;

  @ManyToOne(() => Usuario, { onDelete: "CASCADE", nullable: false })
  usuario: Usuario;
}
