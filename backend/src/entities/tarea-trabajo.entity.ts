import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { PeriodoTrabajo } from "./periodo-trabajo.entity";

// Tarea de un trabajo con modalidad de cobro 'por_tarea' (2026-09-05).
// Espejo de `jornada_trabajo` para esa modalidad: cada tarea se carga dentro de
// un período con su `montoTarea` (monto ganado, cargado a mano) y su
// `fechaHoraTarea` (fecha/hora efectiva en que se realizó). No hay propina ni
// depósito a cuenta al cargar: el ingreso se materializa al cobrar el período.
@Entity({ name: "tarea_trabajo" })
export class TareaTrabajo {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Momento del REGISTRO (lo setea el sistema con `now`, nunca el cliente).
  @Column({ type: "timestamptz" })
  fechaCarga: Date;

  // Fecha y hora EFECTIVA de la tarea (la carga el usuario).
  @Column({ type: "timestamptz" })
  fechaHoraTarea: Date;

  // FECHA CALENDARIO LOCAL de la tarea (la que eligió el usuario). Se guarda
  // como `date` (sin zona) —igual que fechaJornada y los períodos— para
  // agrupar/validar por la fecha LOCAL del usuario sin ambigüedad de zona
  // horaria (decisión 2026-09-05). `fechaHoraTarea` conserva el instante
  // exacto (para mostrar la hora).
  @Column({ type: "date" })
  fechaTarea: Date;

  // Opcional: nombre/detalle de la tarea. Se precarga con la fecha/hora y el
  // usuario puede editarlo o vaciarlo.
  @Column({ default: null })
  descripcion?: string;

  // Opcional e INFORMATIVA: horas invertidas en la tarea. NO afecta el monto.
  @Column({ type: "numeric", precision: 10, scale: 2, default: null })
  horasTarea?: number;

  // Monto ganado en la tarea (se carga a mano; obligatorio).
  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  montoTarea: number;

  @Column({
    default: false,
  })
  eliminado: boolean;

  @ManyToOne(() => PeriodoTrabajo)
  periodoTrabajo: PeriodoTrabajo;
}
