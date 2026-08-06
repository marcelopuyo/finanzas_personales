import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

// Solo columnas. La relación inversa OneToMany (gastos) se omite para evitar
// imports circulares; el lado propietario (Gasto.periodo) es suficiente.
@Entity({ name: "periodo_gasto" })
export class PeriodoGasto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  @Column({ type: "date" })
  fechaApertura: Date;

  @Column({ type: "date" })
  fechaCierre: Date;

  @Column({
    default: false,
  })
  eliminado: boolean;
}
