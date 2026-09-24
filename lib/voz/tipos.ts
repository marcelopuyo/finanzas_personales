/**
 * Tipos del motor de dictado por voz. Ver `DeepSeek/plan-dictado-voz.md`.
 *
 * El motor es **genérico**: la pantalla solo declara qué campos se pueden llenar
 * por voz (`ConfigDictado`) y el parser hace el resto.
 */

/** Tipo de dato que un campo acepta por voz. */
export type TipoCampoVoz = "texto" | "monto" | "fecha" | "opcion";

/**
 * Catálogos con **vocabulario** soportado (R12: la granularidad es por catálogo).
 *
 * ⚠️ Es la única fuente de verdad del tipo: `backend/src/lib/vocabulario.ts`
 * construye su lista de ámbitos con `satisfies readonly AmbitoVoz[]`, así que
 * agregar un catálogo acá **rompe el typecheck** hasta registrarlo allá (y en el
 * `Enum` de la base).
 */
export type AmbitoVoz = "categoriaGasto" | "cuenta";

/** Opción seleccionable de un campo `opcion` (select / combobox). */
export interface OpcionVoz {
  /** Valor que se escribe en el formulario (id o nombre, según el campo). */
  value: string;
  /** Texto visible: es lo que el usuario nombra al dictar. */
  label: string;
}

/** Un concepto del **diccionario de sistema** con su jerga (ver `vocabulario.ts`). */
export interface ConceptoVoz {
  /** Identificador genérico del concepto (`tabaco`, `combustible`…). */
  concepto: string;
  /** Palabras que el usuario puede decir (en forma normalizada o no). */
  alias: string[];
}

/** Un alias resuelto contra una opción real del catálogo del usuario. */
export interface AliasOpcion {
  /** `value` de la opción (id o nombre, según el campo). */
  valor: string;
  /** Etiqueta actual de la opción (para los chips). */
  etiqueta: string;
  /** Puntaje del match (1 = el alias es literalmente un token de la etiqueta). */
  puntaje: number;
  /** Concepto de sistema que lo produjo, o `"aprendido"` si lo eligió el usuario. */
  concepto: string;
}

/** Campo del formulario que se puede llenar por voz. */
export interface CampoDictable {
  /** Nombre del campo en el formulario (ej. `montoOrigen`). */
  campo: string;
  tipo: TipoCampoVoz;
  /** Rótulo visible del campo (para los chips de "lo que entendí"). */
  etiqueta?: string;
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
  /**
   * Catálogo al que apunta el campo (`categoriaGasto`, `cuenta`…). R12: la
   * granularidad del vocabulario aprendido es **por catálogo**. Es la clave con la
   * que `useAliasDeCampo()` pide el diccionario del ámbito correcto.
   */
  catalogo?: AmbitoVoz;
  /**
   * **Alias ya resueltos** contra las opciones de *este* usuario, listos para que
   * el parser los use: término dictado → opciones del usuario (1 = determinista,
   * varias = candidatos).
   *
   * Lo arma la pantalla con `useAliasDeCampo()` (`components/voz/voz-provider.tsx`),
   * que fusiona la capa de **sistema** (concepto → tus categorías, por tokens de la
   * etiqueta) con la **aprendida** (término → id, que pisa todo).
   *
   * ℹ️ Se declara como `Map` a propósito: la config vive en el cliente y nunca
   * cruza el límite de RSC (si algún día cruza, hay que serializarla).
   */
  alias?: Map<string, AliasOpcion[]>;
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
  /** Match del vocabulario (sistema o aprendido): máxima prioridad entre las opciones. */
  | "alias"
  | "resto"
  /** Completado con el último gasto que tenía esa misma descripción. */
  | "historial";

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
  /**
   * Palabras del dictado que produjeron la ambigüedad. Se usan para **aprender**
   * cuando el usuario elige una (vía A del plan de G2).
   */
  termino: string;
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
  /**
   * La intención **deja el texto sobrante** para que la pantalla destino lo
   * parsee contra sus campos (hoy solo `cargar-gasto`, vía `lib/voz/handoff`).
   * Las de navegación no tienen campos que llenar ⇒ no se guarda nada.
   */
  llevaTexto?: boolean;
  /** Frase de ejemplo: es el **atajo tocable** que ofrece la burbuja del FAB. */
  ejemplo?: string;
}

export interface ResultadoIntencion {
  intencion: Intencion | null;
  /** Texto sobrante, ya sin las palabras de la intención (va al destino). */
  resto: string;
}
