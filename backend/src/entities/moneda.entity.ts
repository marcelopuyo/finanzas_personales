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

  @Column({
    default: false,
  })
  eliminado: boolean;
}
