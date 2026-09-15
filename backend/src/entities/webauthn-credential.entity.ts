import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Usuario } from "./usuario.entity";

/**
 * Credencial **WebAuthn / passkey** de un usuario: una fila por DISPOSITIVO (o
 * gestor de passkeys) que el usuario habilitó.
 *
 * Cómo funciona (2026-09-15):
 * - Al "activar biometría", el dispositivo genera un par de claves y **la
 *   privada nunca sale del equipo**; acá se guarda solo la **pública**.
 * - En el login, el dispositivo firma un desafío y el servidor verifica esa
 *   firma con la clave pública ⇒ sesión (misma cookie JWT de siempre).
 *
 * ⚠️ `credentialId` es el `rawId` en base64url y es único GLOBAL: es la clave
 * con la que se busca la credencial durante el login (que es "sin usuario",
 * con passkeys descubribles).
 */
@Entity({ name: "webauthn_credential" })
export class WebauthnCredential {
  @PrimaryGeneratedColumn("increment")
  id: number;

  /** `rawId` de la credencial (base64url). */
  @Column({ unique: true })
  credentialId: string;

  /** Clave pública COSE (base64url). */
  @Column({ type: "text" })
  publicKey: string;

  /** Contador de firmas del autenticador (defensa anti-replay). */
  @Column({ type: "integer", default: 0 })
  counter: number;

  /** Transportes informados por el navegador (`internal,hybrid,usb`…). */
  @Column({ type: "varchar", length: 64, nullable: true })
  transports: string | null;

  /** `singleDevice` (queda en el equipo) | `multiDevice` (sincronizada). */
  @Column({ type: "varchar", length: 32, nullable: true })
  deviceType: string | null;

  /** `true` si la passkey está respaldada/sincronizada (iCloud, Google…). */
  @Column({ type: "boolean", default: false })
  backedUp: boolean;

  /** Etiqueta que muestra el usuario ("iPhone de Marcelo"). */
  @Column({ type: "varchar", length: 80, nullable: true })
  nombre: string | null;

  @Column({ type: "timestamp", default: () => "now()" })
  creadoEn: Date;

  @Column({ type: "timestamp", nullable: true })
  ultimoUsoEn: Date | null;

  @Column({ type: "boolean", default: false })
  eliminado: boolean;

  @ManyToOne(() => Usuario, { onDelete: "CASCADE", nullable: false })
  usuario: Usuario;
}
