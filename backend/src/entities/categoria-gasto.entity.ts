import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Usuario } from "./usuario.entity";

// Solo columnas. La relación inversa OneToMany (gastos) se omite para evitar
// imports circulares; el lado propietario (Gasto.categoria) es suficiente.
@Entity({ name: "categoria_gasto" })
export class CategoriaGasto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nombre: string;

  @Column({
    default: false,
  })
  eliminado: boolean;

  @ManyToOne(() => Usuario, { onDelete: "CASCADE", nullable: false })
  usuario: Usuario;
}
