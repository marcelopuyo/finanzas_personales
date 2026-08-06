import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { Usuario } from "./usuario.entity";

// Solo columnas. La relación inversa OneToMany (periodosTrabajo) se omite
// para evitar ciclos; se consulta por separado cuando se necesita.
// El nombre es único POR USUARIO (no global).
@Entity({ name: "trabajo" })
@Unique(["nombre", "usuario"])
export class Trabajo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  @Column({ type: "date" })
  fechaInicio: Date;

  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  precioHora: number;

  @Column({ default: null })
  memos?: string;

  @Column({
    default: false,
  })
  eliminado: boolean;

  @ManyToOne(() => Usuario, { onDelete: "CASCADE", nullable: false })
  usuario: Usuario;
}
