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
 *
 * ➕ `navegacion` (plan §15.6): **órdenes de navegación** aprendidas. El
 * `destinoValor` es el **id de la intención** (`ir-panel-prestamos`…), no un id de
 * catálogo; la etiqueta es la del destino ("Préstamos"). ⚠️ La columna `ambito` es
 * `varchar(40)` **sin CHECK** ⇒ este ámbito no necesita migración (verificado).
 */
export type AmbitoVoz = "categoriaGasto" | "cuenta" | "navegacion";

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
  /**
   * `true` = el valor salió de la **zona del campo nombrado** ("monto 500",
   * "descripción pizza").
   *
   * 🔑 Es lo que distingue **explícito** de **implícito** (regla 7 de §15.4):
   * *lo explícito **pisa** el valor que hubiera; lo implícito sólo completa
   * campos **vacíos***. La política la aplica la pantalla (que conoce el
   * formulario); el parser sólo marca el origen.
   */
  explicito?: boolean;
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
  /**
   * **Etiquetas** de los campos que el dictado **NO tocó** por la regla 7 de
   * §15.4 (*"lo implícito no pisa"*): ya tenían un valor y el dictado no los
   * nombró. La burbuja lo dice en voz alta ("No toqué Cuenta: ya tenía valor").
   */
  omitidos: string[];
}

/**
 * Par (ámbito, término) de un alias **propio** que resolvió un valor del dictado.
 * Es lo que se manda a sumar `usos` **al guardar** (no en el camino del dictado).
 */
export interface UsoAliasDictado {
  ambito: string;
  terminoNorm: string;
}

/** Las dos —y únicas— cosas que hace la voz (plan de voz §15: catálogo cerrado). */
export type IntencionTipo = "navegacion" | "carga";

/** Intención global (botón flotante / entrada por URL). */
export interface Intencion {
  id: string;
  /** Qué hace la intención: **navegar** o **cargar** (llenar un wizard). */
  tipo: IntencionTipo;
  /** Sustantivos que la disparan ("gasto", "prestamos"). **Son los que mandan** en la navegación. */
  sustantivos: string[];
  /**
   * Verbos: de **movimiento** (navegación: *mostrame, andá, abrí*) o de **gasto**
   * (carga: *gasté, pagué, compré*).
   *
   * ⚠️ En la navegación el verbo es **decorativo** (el sustantivo manda); en la
   * carga **es obligatorio** salvo que la frase diga el sustantivo `gasto`.
   */
  verbos: string[];
  /** A dónde navega. `dato` = valor del **destino parametrizado** (`ir-cuenta`). */
  href: (dato?: string) => string;
  /**
   * **Destino parametrizado**: necesita un dato resuelto en la frase (hoy solo
   * `cuenta` ⇒ `/cuentas/<id>`). El FAB exige que venga resuelto (`dato`) o que el
   * usuario elija entre `datoCandidatos`.
   */
  dato?: "cuenta";
  /** Etiqueta visible del destino (lista de opciones del FAB, «Lo que aprendí»). */
  etiqueta?: string;
  /**
   * Navegación: exige un **verbo de movimiento** (no alcanza la frase corta con
   * el sustantivo solo). Lo usa el panel **Gastos**, cuyo sustantivo (`gastos`)
   * convive con el de la carga: *"cargar gastos"* **no** debe navegar.
   */
  soloConVerbo?: boolean;
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
  /**
   * Palabras de **jerga de la orden** que no son contenido y se descartan del
   * texto sobrante ("**cargar** un gasto" ⇒ sobrante vacío). No cuentan como
   * verbos de la intención (no disparan nada por sí solas).
   */
  relleno?: string[];
}

export interface ResultadoIntencion {
  intencion: Intencion | null;
  /** Texto sobrante, ya sin las palabras de la intención (va al destino). */
  resto: string;
  /** Valor resuelto del **destino parametrizado** (hoy: id de la cuenta). */
  dato?: string;
  /** Término dictado que produjo el dato (se **aprende** si el usuario elige). */
  terminoDato?: string;
  /** El término apuntó a **varias** opciones: el FAB las ofrece ("¿cuál de estas?"). */
  datoCandidatos?: OpcionVoz[];
  /**
   * **No se reconoció el destino** (plan §15.6): el FAB ofrece el catálogo de
   * destinos navegables y lo que el usuario elija **se aprende**.
   */
  destinos?: Intencion[];
  /** Término significativo que no se entendió: es lo que se aprende al elegir. */
  terminoDesconocido?: string;
  /**
   * La frase es una **consulta** ("cuánto gasté este mes"): la voz **no la usa**
   * —no navega, no llena campos— y el FAB lo dice en vez de intentar adivinar
   * (decisión del usuario, 2026-09-24: fuera de los ejemplos y del uso).
   */
  esConsulta?: boolean;
}
