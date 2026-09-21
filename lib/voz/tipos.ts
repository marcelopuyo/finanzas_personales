/**
 * Tipos del motor de dictado por voz. Ver `DeepSeek/plan-dictado-voz.md`.
 *
 * El motor es **genérico**: la pantalla solo declara qué campos se pueden llenar
 * por voz (`ConfigDictado`) y el parser hace el resto.
 */

/** Tipo de dato que un campo acepta por voz. */
export type TipoCampoVoz = "texto" | "monto" | "fecha" | "opcion";

/** Opción seleccionable de un campo `opcion` (select / combobox). */
export interface OpcionVoz {
  /** Valor que se escribe en el formulario (id o nombre, según el campo). */
  value: string;
  /** Texto visible: es lo que el usuario nombra al dictar. */
  label: string;
}

/** Campo del formulario que se puede llenar por voz. */
export interface CampoDictable {
  /** Nombre del campo en el formulario (ej. `montoOrigen`). */
  campo: string;
  tipo: TipoCampoVoz;
  /**
   * Palabras que introducen el campo ("monto", "importe", "descripción"…).
   * Si aparecen, lo que sigue se asigna a ese campo **sin heurística**.
   */
  disparadores?: string[];
  /** Fuente de las opciones (solo `tipo: "opcion"`). */
  opciones?: () => OpcionVoz[];
  /**
   * Diccionario local de sinónimos: término dictado → etiquetas de opción.
   * Es lo que permite que "nafta" caiga en la categoría "Combustible".
   */
  sinonimos?: Record<string, string[]>;
  /** Convierte el valor a número antes de escribirlo (campos con id). */
  numerico?: boolean;
  /**
   * Un match de este campo **también** puede quedar como Descripción.
   * Se usa en Categoría: "gasté tres mil en el supermercado" debe elegir la
   * categoría **y** dejar "Supermercado" como descripción. En Cuenta va en
   * `false`, porque "Santander" no es una descripción de gasto.
   */
  aportaTexto?: boolean;
}

/** Declaración de los campos dictables de una pantalla. */
export interface ConfigDictado {
  lang?: string;
  campos: CampoDictable[];
}

/** De dónde salió el valor de un campo (para explicarlo en el chip). */
export type OrigenAsignacion =
  | "disparador"
  | "numero"
  | "fecha"
  | "opcion"
  | "sinonimo"
  | "resto";

/** Un campo que el dictado logró completar. */
export interface Asignacion {
  campo: string;
  valor: string | number;
  /** Tramo del dictado que lo originó. */
  texto: string;
  origen: OrigenAsignacion;
  /** 1 = certeza total; menos de 1 = match difuso. */
  puntaje: number;
}

/** Un campo `opcion` donde el dictado no se animó a elegir (D6). */
export interface Candidato {
  campo: string;
  opciones: OpcionVoz[];
}

/** Resultado de parsear una frase contra una `ConfigDictado`. */
export interface ResultadoDictado {
  /** Valores listos para escribir en el formulario. */
  valores: Record<string, string | number>;
  asignaciones: Asignacion[];
  candidatos: Candidato[];
  /** Palabras que no se pudieron ubicar en ningún campo. */
  noEntendido: string[];
}

/** Intención global (botón flotante / entrada por URL). */
export interface Intencion {
  id: string;
  /** Sustantivos que la disparan ("gasto"). */
  sustantivos: string[];
  /** Verbos de acción que la confirman ("cargar", "anotar"…). */
  verbos: string[];
  /** A dónde navega. */
  href: () => string;
  /** Si el destino necesita que el usuario elija una cuenta. */
  requiereCuenta?: boolean;
}

export interface ResultadoIntencion {
  intencion: Intencion | null;
  /** Texto sobrante, ya sin las palabras de la intención (va al destino). */
  resto: string;
}
