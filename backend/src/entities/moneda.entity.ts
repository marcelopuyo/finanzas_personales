import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

// Solo columnas. Las relaciones inversas OneToMany (cotizaciones/cuentas) se
// omiten para evitar imports circulares; el lado propietario (ManyToOne en
// Cotizacion/Cuenta) es suficiente para cargar relaciones en las queries.
@Entity({ name: "moneda" })
export class Moneda {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  simbolo: string;

  @Column({ unique: true })
  nombre: string;

  /** Código ISO 4217 (ej. "ARS", "USD") — usado por el formateo de montos. */
  @Column()
  codigoISO: string;

  @Column({
    default: false,
  })
  eliminado: boolean;
}
