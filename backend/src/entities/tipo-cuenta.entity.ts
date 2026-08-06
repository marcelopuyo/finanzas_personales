import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

// Solo columnas. La relación inversa OneToMany (cuentas) se omite para evitar
// imports circulares; el lado propietario (Cuenta.tipo) es suficiente.
@Entity({ name: "tipo_cuenta" })
export class TipoCuenta {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nombre: string;

  @Column({
    default: false,
  })
  eliminado: boolean;
}
