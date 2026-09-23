import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Usuario } from "./usuario.entity";

/**
 * **Vocabulario de voz** (2026-09-23 · G2 del plan `DeepSeek/plan-dictado-voz.md` §14).
 *
 * Guarda cómo llama el usuario a las cosas, para que el dictado lo entienda sin
 * IA: la primera vez el usuario elige ("kiosco" → categoría *Diario - Otros*) y a
 * partir de ahí **la app ya lo sabe**.
 *
 * La tabla tiene **dos capas**, distinguidas por `usuarioId`:
 *
 * | | `usuarioId` | `destinoValor` | Cómo resuelve |
 * |---|---|---|---|
 * | **Aprendida** | el usuario logueado (R13) | **id** de una opción | por **id** contra las opciones del campo |
 * | **Sistema** (curada) | `NULL` | **concepto** ("supermercado") | por **parecido** contra el catálogo del usuario |
 *
 * ⚠️ **Nunca se resuelve por etiqueta en la capa aprendida** (`destinoEtiqueta` es
 * solo para mostrar): si la categoría se renombra, un alias guardado por etiqueta
 * se rompería en silencio.
 *
 * ⚠️ **La capa de sistema no puede apuntar a ids** (los ids son por usuario) ⇒
 * apunta a conceptos y el parser busca el parecido en el catálogo real.
 */
@Entity({ name: "voz_alias" })
export class VozAlias {
  @PrimaryGeneratedColumn("increment")
  id: number;

  /** Dueño del alias. **`null` = capa de SISTEMA** (sirve a todos los usuarios). */
  @ManyToOne(() => Usuario, { onDelete: "CASCADE", nullable: true })
  usuario: Usuario | null;

  /** Catálogo al que apunta (R12): `categoriaGasto` · `cuenta` · `trabajo`… */
  @Column({ type: "varchar", length: 40 })
  ambito: string;

  /** Cómo lo dijo el usuario ("kiosco"), tal cual. */
  @Column({ type: "varchar", length: 80 })
  termino: string;

  /** El término normalizado (minúsculas, sin tildes): la clave de búsqueda. */
  @Column({ type: "varchar", length: 80 })
  terminoNorm: string;

  /** `value` de la opción (id) o **concepto** si es una fila de sistema. */
  @Column({ type: "varchar", length: 120 })
  destinoValor: string;

  /** Etiqueta del destino al momento de aprender (solo para mostrar). */
  @Column({ type: "varchar", length: 120 })
  destinoEtiqueta: string;

  /** `sistema` (curada) · `ambiguedad` (eligió un candidato) · `correccion` (corrigió la voz). */
  @Column({ type: "varchar", length: 20 })
  origen: string;

  /** Cuántas veces resolvió (sirve para detectar alias de un solo uso). */
  @Column({ type: "integer", default: 0 })
  usos: number;

  /** Cuántas veces el usuario lo pisó con una corrección. */
  @Column({ type: "integer", default: 0 })
  correcciones: number;

  @Column({ type: "boolean", default: true })
  activo: boolean;

  /** Soft delete: "olvidar" pone esto en `true` (recuperable). */
  @Column({ type: "boolean", default: false })
  eliminado: boolean;

  @Column({ type: "timestamp", default: () => "now()" })
  creadoEn: Date;

  @Column({ type: "timestamp", nullable: true })
  actualizadoEn: Date | null;
}
