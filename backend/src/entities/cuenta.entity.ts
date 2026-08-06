import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { TipoCuenta } from "./tipo-cuenta.entity";
import { Moneda } from "./moneda.entity";

// Lado propietario (ManyToOne) de tipo y moneda. Las relaciones inversas
// (historial, movimientos, prestamos, tarjeta) se agregan cuando se migren
// esos módulos, sin crear imports circulares.
@Entity({ name: "cuenta" })
export class Cuenta {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nombre: string;

  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  saldo: number;

  @Column({
    default: false,
  })
  eliminado: boolean;

  // FK a Tarjeta. La relación OneToOne se agrega al migrar el módulo de
  // tarjetas (Fase 4); por ahora se mapea como columna simple.
  @Column({ type: "int", nullable: true })
  tarjetaId?: number | null;

  @ManyToOne(() => TipoCuenta, {
    onDelete: "CASCADE",
  })
  tipo: TipoCuenta;

  @ManyToOne(() => Moneda, {
    onDelete: "CASCADE",
  })
  moneda?: Moneda;
}
