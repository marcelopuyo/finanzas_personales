import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

/**
 * Usuario del sistema multiusuario. Cada usuario ve y opera solo con sus datos
 * (la mayoría de las tablas tendrán una FK `usuarioId`).
 *
 * La contraseña se guarda como hash bcrypt (NUNCA en texto plano). El email
 * debe verificarse antes de poder operar (decisión del usuario 2026-08-06).
 */
@Entity({ name: "usuario" })
export class Usuario {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ default: null })
  nombre?: string;

  /** False hasta que el usuario verifique su email (flujo de registro). */
  @Column({ default: false })
  emailVerificado: boolean;

  @Column({ default: true })
  activo: boolean;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  creadoEn: Date;
}
