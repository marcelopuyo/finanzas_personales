import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Moneda } from "./moneda.entity";
import { Usuario } from "./usuario.entity";

// Cotización entre DOS monedas (origen → destino). La tasa es direccional:
// `1 unidad de monedaOrigen = cotizacion × 1 unidad de monedaDestino`.
// - `fechaFinal = NULL` → período vigente (la cotización actual del par).
// - `usuario = NULL` → fila GLOBAL (traída por la API, compartida entre
//   todos los usuarios). No hay cotizaciones manuales (decisión 2026-08-10).
@Entity({ name: "cotizacion" })
export class Cotizacion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "date" })
  fechaInicial: Date;

  @Column({ type: "date", nullable: true })
  fechaFinal?: Date | null;

  @Column({ type: "numeric", precision: 18, scale: 8, default: 0 })
  cotizacion: number;

  @Column({
    default: false,
  })
  eliminado: boolean;

  @ManyToOne(() => Moneda, {
    onDelete: "CASCADE",
    nullable: false,
  })
  monedaOrigen: Moneda;

  @ManyToOne(() => Moneda, {
    onDelete: "CASCADE",
    nullable: false,
  })
  monedaDestino: Moneda;

  @ManyToOne(() => Usuario, {
    onDelete: "CASCADE",
    nullable: true,
  })
  usuario?: Usuario | null;
}

