import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

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
    type: "bit",
    default: false,
  })
  eliminado: boolean;
}
