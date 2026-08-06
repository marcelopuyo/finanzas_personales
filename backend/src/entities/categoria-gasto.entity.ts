import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { Usuario } from "./usuario.entity";

// Solo columnas. La relación inversa OneToMany (gastos) se omite para evitar
// imports circulares; el lado propietario (Gasto.categoria) es suficiente.
// El nombre es único POR USUARIO (no global).
@Entity({ name: "categoria_gasto" })
@Unique(["nombre", "usuario"])
export class CategoriaGasto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  @Column({
    default: false,
  })
  eliminado: boolean;

  @ManyToOne(() => Usuario, { onDelete: "CASCADE", nullable: false })
  usuario: Usuario;
}
