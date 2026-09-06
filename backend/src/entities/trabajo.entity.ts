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

  // Modalidad de cobro del trabajo (2026-09-04/05):
  // 'fijo' | 'horas_fijas' | 'horas_variables' (actual) | 'por_tarea'.
  // Default 'horas_variables' = comportamiento actual (sin backfill).
  @Column({ default: "horas_variables" })
  modalidadCobro: string;

  @Column({ default: null })
  memos?: string;

  @Column({
    default: false,
  })
  eliminado: boolean;

  @ManyToOne(() => Usuario, { onDelete: "CASCADE", nullable: false })
  usuario: Usuario;
}
