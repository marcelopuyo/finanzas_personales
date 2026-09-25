"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Mic, Settings, Trash2, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTap } from "@/lib/tap";
import { norm } from "@/lib/voz/normalizar";
import { usePendingNav } from "@/components/ui/nav-progress";
import { Modal } from "@/components/ui/modal";
import { VOZ_LANG } from "@/lib/voz/config";
import { dejarTexto, tomarTexto } from "@/lib/voz/handoff";
import { INTENCIONES } from "@/lib/voz/intenciones";
import { parsearIntencion } from "@/lib/voz/parse-intencion";
import { parsearCampos } from "@/lib/voz/parse-campos";
import {
  useCuentasNavegables,
  useNavegacionAprendida,
  useVoz,
} from "./voz-provider";
import {
  usePantallaDictable,
  useUltimoDictado,
} from "./dictado-pantalla";
import type { AliasVozOut } from "@/backend/src/queries/voz";
import { ChipAsignacion } from "./chip-asignacion";
import type {
  Asignacion,
  CampoDictable,
  Candidato,
  Intencion,
  OpcionVoz,
  ResultadoDictado,
  UsoAliasDictado,
} from "@/lib/voz/tipos";
import {
  iniciarDictado,
  soporteVoz,
  type ErrorVoz,
  type EstadoDictado,
  type SesionDictado,
} from "@/lib/voz/speech";

/**
 * **FAB 🎤 global** — fases **G1** (navegación) y **G3** (llenado) del replanteo de
 * la voz (plan §14: R1-R8).
 *
 * Un solo botón que decide **qué quiere hacer** el usuario:
 * 1. **Orden explícita de navegación** (`ir-*`) ⇒ navega (aunque la pantalla
 *    actual tenga campos).
 * 2. **Su destino es la pantalla actual** ("cargar un gasto" estando ya en el
 *    formulario) ⇒ **llena** los campos de esta pantalla.
 * 3. **Intención de carga** con otro destino ⇒ navega y deja el sobrante en el
 *    handoff (`llevaTexto`, D10).
 * 4. **Sin intención y con campos dictables** ⇒ **llena** (G3).
 * 5. **No la reconoce** ⇒ burbuja con **ejemplos tocables** (R3), sin navegar.
 *
 * Al llenar, la burbuja muestra **chips** de lo que completó (con ✕ por campo),
 * **candidatos** cuando hubo ambigüedad (elegir = **aprender**, vía A) y
 * **Deshacer** (1 nivel).
 *
 * ⚠️ **No hay campo de texto ni panel**: el dictado arranca con el FAB y el
 * resultado se aplica directo (decisión §14/R1-R2).
 *
 * ⚠️ **La voz nunca guarda** (D2): escribe los campos y vos tocás Guardar.
 *
 * 🔑 **Motores y receta**: `lib/voz/speech.ts` trae los defaults por plataforma
 * (`dictadoRecomendado()`): la receta de iOS está probada en un iPhone real
 * (bitácora §144) y en Chrome/Edge se usa el modo continuo. Acá no se elige nada.
 *
 * 📍 **Posición** (R4: abajo a la derecha, **apilado** sobre la acción primaria):
 * la maneja `globals.css` con la clase `.fp-voz-fab` + `:has([data-barra-inferior])`.
 *
 * Se monta en `AppLayout` (área de usuario) **fuera** de `PullToRefresh`: usa touch
 * events propios y no debe disparar el gesto de "tirar para actualizar".
 */
const MENSAJE_ERROR: Record<ErrorVoz, string> = {
  permiso: "No tengo permiso para usar el micrófono. Habilitalo y probá de nuevo.",
  "sin-habla": "No te escuché. Probá de nuevo hablando un poco más fuerte.",
  "sin-red": "Sin conexión el dictado no funciona: el reconocimiento lo hace el navegador.",
  "no-soportado": "Este navegador no soporta dictado por voz. Probá con Chrome, Edge o Safari.",
  desconocido: "El reconocedor falló. Probá otra vez.",
};

/** Aviso de la burbuja (R8: pegada al FAB). `escuchado` solo cuando no entendió. */
type Aviso = { texto: string; escuchado?: string } | null;

/**
 * Destino **no reconocido** (§15.6): la orden era de navegación pero el término no
 * está en el catálogo ⇒ se ofrecen los destinos y el elegido se aprende.
 * `termino` viene sólo cuando vale la pena aprender (1-2 palabras significativas).
 */
type PreguntaNav = { destinos: Intencion[]; termino?: string } | null;

/** Cuenta **ambigua** (`ir-cuenta`): el usuario elige entre las suyas y se aprende. */
type PreguntaCuenta = {
  opciones: OpcionVoz[];
  termino: string;
  /** `true` = el nombre **no se reconoció** (se ofrecen todas las cuentas). */
  sinResolver?: boolean;
} | null;

/** Margen (px) alrededor de la franja del FAB para decidir si se corre. */
const MARGEN_FRANJA = 8;

/** ¿El destino de esta intención **es** la pantalla actual? (sin query) */
function esMiPantallaDe(intencion: Intencion, ruta: string): boolean {
  return intencion.href().split("?")[0] === ruta;
}

/**
 * **Paleta de las píldoras de OPCIÓN** (candidatos, destinos de navegación y
 * cuentas): cada opción toma un color distinto, en **tinte semitransparente**
 * (fondo al 10 %, borde al 40 %, texto pleno) — el mismo lenguaje que usan los
 * chips de estado de la app (`bg-success/10 text-success`).
 *
 * 🔑 Se **cicla por índice**: determinista, independiente del texto, y dos opciones
 * seguidas nunca comparten color. Los tokens (`primary`/`success`/`warning`/`danger`)
 * están definidos en **los dos temas** (`app/globals.css`).
 */
const PALETA_OPCION = [
  "border-primary/40 bg-primary/10 text-primary",
  "border-success/45 bg-success/10 text-success",
  "border-warning/45 bg-warning/10 text-warning",
  "border-danger/40 bg-danger/10 text-danger",
];

/** Color del tinte que le toca a la opción en la posición `indice`. */
function colorOpcion(indice: number): string {
  return PALETA_OPCION[indice % PALETA_OPCION.length];
}

/** Nombre visible del catálogo de un alias aprendido (lista «Lo que aprendí»). */
function etiquetaAmbito(ambito: string): string {
  if (ambito === "cuenta") return "Cuentas";
  if (ambito === "navegacion") return "Navegación";
  return "Categorías de gasto";
}

/** "Cuenta", "Cuenta y Fecha", "Monto, Cuenta y Fecha" (para los avisos). */
function listar(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/** La sesión terminó y no se reconoció nada (feedback garantizado, 2026-09-23). */
const SIN_TEXTO: Aviso = {
  texto: "No te escuché. Probá de nuevo hablando un poco más fuerte.",
};

/** Campo de la config (de la pantalla actual o la que viaja con el dictado). */
function buscarCampo(campos: CampoDictable[], nombre: string) {
  return campos.find((c) => c.campo === nombre);
}

/**
 * Alias **propio** que resolvió una asignación (mismo criterio para el chip
 * "olvidar" y para el contador `usos`): el campo tiene catálogo y el término
 * dictado es una fila del usuario.
 */
function filaPropiaDe(
  a: Asignacion,
  campos: CampoDictable[],
  filas: AliasVozOut[]
) {
  const catalogo = buscarCampo(campos, a.campo)?.catalogo;
  if (!catalogo) return undefined;
  const terminoNorm = norm(a.texto);
  return filas.find(
    (f) =>
      f.usuarioId !== null &&
      f.ambito === catalogo &&
      f.terminoNorm === terminoNorm
  );
}

/**
 * Pares (ámbito, término) de los alias propios que resolvieron valores: es lo
 * que se le suma a `usos` **al guardar** (ver `VozProvider.registrarUsos`).
 */
function usosDeDictado(
  resultado: ResultadoDictado,
  campos: CampoDictable[],
  filas: AliasVozOut[]
): UsoAliasDictado[] {
  return resultado.asignaciones
    .filter((a) => a.origen === "alias")
    .map((a) => filaPropiaDe(a, campos, filas))
    .filter((f): f is AliasVozOut => Boolean(f))
    .map((f) => ({ ambito: f.ambito, terminoNorm: f.terminoNorm }));
}

export function VozFab() {
  const { go } = usePendingNav();
  const ruta = usePathname();
  const buscar = useSearchParams();
  const dicho = buscar.get("dicho") ?? "";
  /** Pantalla actual (si se declaró dictable) y vocabulario en memoria. */
  const pantalla = usePantallaDictable();
  const voz = useVoz();
  /** Cuentas del usuario (`ir-cuenta`) y órdenes de navegación aprendidas (§15.6). */
  const cuentasVoz = useCuentasNavegables();
  const navesAprendidas = useNavegacionAprendida();
  const [estado, setEstado] = useState<EstadoDictado>("listo");
  const [aviso, setAviso] = useState<Aviso>(null);
  /**
   * `true` mientras hay una **acción primaria a la vista** (el pie de un
   * formulario dentro de la franja del FAB): el FAB se corre para no taparla.
   */
  const [ceder, setCeder] = useState(false);
  /** Preguntas de navegación pendientes (plan §15.6 y `ir-cuenta`). */
  const [preguntaNav, setPreguntaNav] = useState<PreguntaNav>(null);
  const [preguntaCuenta, setPreguntaCuenta] = useState<PreguntaCuenta>(null);
  /**
   * Último dictado aplicado. Vive en el **contexto** (no en el FAB) para que la
   * pantalla pueda leerlo al guardar y aprender las correcciones (vía B).
   */
  const { ultimo: dictado, setUltimo: setDictado } = useUltimoDictado();
  const sesion = useRef<SesionDictado | null>(null);
  /** El botón, para **medir** la franja que se corre (F5). */
  const botonRef = useRef<HTMLButtonElement | null>(null);
  /** El motor ya avisó un error más específico: no lo pisa el "no te escuché". */
  const huboError = useRef(false);

  // Al cambiar de ruta el FAB vuelve a mostrarse YA (ajuste DURANTE el render,
  // sin `setState` en un efecto): la página nueva no tiene por qué heredar el
  // "hacerse a un lado" de la anterior. También se **descarta el último dictado**
  // (era de la pantalla anterior: no sirve para la vía B de esta).
  const [rutaDelCeder, setRutaDelCeder] = useState(ruta);
  if (rutaDelCeder !== ruta) {
    setRutaDelCeder(ruta);
    setCeder(false);
    setDictado(null);
    // Las preguntas de navegación eran de la pantalla anterior.
    setPreguntaNav(null);
    setPreguntaCuenta(null);
  }

  const escuchando = estado === "iniciando" || estado === "escuchando";

  /** `?dicho=` (Atajo de Apple) se aplica **una sola vez**. */
  const dichoUsado = useRef(false);
  /** Sheet «Lo que aprendí» (R11). */
  const [verAprendido, setVerAprendido] = useState(false);

  /** Alias **propios** (los que el usuario puede olvidar), del más usado al menos. */
  const aprendidas = [...(voz?.filas ?? [])]
    .filter((f) => f.usuarioId !== null)
    .sort((a, b) => b.usos - a.usos || a.termino.localeCompare(b.termino));

  /** Navega dejando el sobrante para la pantalla destino (D10). */
  const navegar = (intencion: Intencion, resto: string, dato?: string) => {
    if (intencion.llevaTexto && resto) dejarTexto(resto);
    go(intencion.href(dato), `voz-${intencion.id}`);
  };

  /** Llena la pantalla actual con lo dictado. `true` si aplicó algo. */
  const llenar = useCallback(
    async (texto: string): Promise<boolean> => {
      if (!pantalla) return false;
      const resultado = parsearCampos(texto, pantalla.config);
      if (!resultado.asignaciones.length && !resultado.candidatos.length) {
        return false;
      }
      const antes = await pantalla.aplicar(resultado);
      // La frase traía cosas, pero el formulario **ya tenía todo** y la regla 7
      // (§15.4: "lo implícito no pisa") descartó cada campo ⇒ se avisa en vez de
      // no decir nada (y **no** se navega: la orden ya se atendió acá).
      // ⚠️ **No** se limpia el dictado anterior: la vía B (aprender la corrección)
      // lo necesita en la confirmación para comparar contra el formulario.
      if (!resultado.asignaciones.length && !resultado.candidatos.length) {
        setAviso({
          escuchado: texto,
          texto: resultado.omitidos.length
            ? `No toqué ${listar(resultado.omitidos)}: ya tenía${
                resultado.omitidos.length === 1 ? "" : "n"
              } valor.`
            : "No entendí qué querías anotar.",
        });
        return true;
      }
      setAviso(null);
      // El dictado se lleva **su** config (por si la pantalla se desmonta: paso de
      // confirmación del wizard) y los alias propios que resolvió, para sumar
      // `usos` al guardar.
      setDictado({
        resultado,
        antes,
        campos: pantalla.config.campos,
        usos: usosDeDictado(resultado, pantalla.config.campos, voz?.filas ?? []),
      });
      return true;
    },
    [pantalla, setDictado, voz?.filas]
  );

  /**
   * Resuelve el texto reconocido. La regla de decisión (R1, plan §6.2) es:
   *
   * 0. **Destino no reconocido con orden de movimiento** (§15.6) ⇒ se ofrecen los
   *    destinos y lo que elija **se aprende** (navega siempre).
   * 1. **Orden explícita de navegación** (`ir-*`) ⇒ navega (con su **dato** si el
   *    destino es parametrizado, `ir-cuenta`); si el dato quedó **ambiguo**, se
   *    ofrecen las cuentas (elegir = navegar + aprender).
   * 2. **Su destino es esta pantalla** ("cargar un gasto" ya en el formulario) ⇒
   *    llena.
   * 3. **Intención de carga** con otro destino ⇒ navega con el sobrante.
   * 4. **Sin intención**, pero la pantalla tiene campos ⇒ llena.
   * 5. Nada de eso ⇒ burbuja con ejemplos.
   */
  const interpretar = async (texto: string) => {
    const {
      intencion,
      resto,
      dato,
      terminoDato,
      datoCandidatos,
      datoSinResolver,
      destinos,
      terminoDesconocido,
      esConsulta,
    } = parsearIntencion(texto, {
      cuentas: cuentasVoz,
      navegacion: navesAprendidas,
    });
    setPreguntaNav(null);
    setPreguntaCuenta(null);

    // **Consultas** ("cuánto gasté este mes"): fuera del uso ⇒ no se navega ni se
    // intenta llenar ningún campo; se dice que todavía no se sabe responder.
    if (esConsulta) {
      setDictado(null);
      setAviso({
        escuchado: texto,
        texto: "Eso todavía no lo sé responder. Probá con uno de estos ejemplos:",
      });
      return;
    }

    // §15.6: no se reconoció el destino pero la orden era de navegación ⇒ se le
    // ofrecen los destinos (y se aprende el término si es uno solo y significativo).
    if (destinos?.length) {
      setAviso(null);
      setPreguntaNav({ destinos, termino: terminoDesconocido });
      return;
    }

    const navegacionExplicita = intencion?.tipo === "navegacion";
    // Destino parametrizado sin dato resuelto (cuenta): no se puede navegar a ciegas.
    const sinDato = Boolean(intencion?.dato && !dato);

    if (intencion && !sinDato && (navegacionExplicita || !pantalla)) {
      if (datoCandidatos?.length) {
        // Ambigüedad (dos cuentas con el mismo nombre) o nombre **no reconocido**
        // (se ofrecen todas las cuentas): elige y se aprende.
        setAviso(null);
        setPreguntaCuenta({
          opciones: datoCandidatos,
          termino: terminoDato ?? "",
          sinResolver: datoSinResolver,
        });
        return;
      }
      setDictado(null);
      navegar(intencion, resto, dato);
      return;
    }

    // El sobrante ya no tiene las palabras de la intención ("gasté"): es lo que
    // hay que parsear contra los campos.
    if ((!intencion || esMiPantallaDe(intencion, ruta)) && (await llenar(resto || texto))) {
      return;
    }

    if (intencion && !sinDato) {
      setDictado(null);
      navegar(intencion, resto, dato);
      return;
    }

    setAviso({
      escuchado: texto,
      texto: "No entendí qué querías hacer. Probá con uno de estos ejemplos:",
    });
  };

  /**
   * **Elegir un destino** cuando la orden no se entendió (§15.6): **siempre
   * navega** (decisión del usuario, 2026-09-24) y, si había un término
   * significativo, **lo aprende** (`usos` +1 al navegar: la orden se cumple en el
   * acto, a diferencia de la carga que suma al guardar).
   */
  const elegirDestino = (intencion: Intencion) => {
    const termino = preguntaNav?.termino;
    setPreguntaNav(null);
    if (termino) {
      void voz
        ?.aprender({
          ambito: "navegacion",
          termino,
          destinoValor: intencion.id,
          destinoEtiqueta: intencion.etiqueta ?? intencion.id,
          origen: "ambiguedad",
        })
        .then(() =>
          voz?.registrarUsos([
            { ambito: "navegacion", terminoNorm: norm(termino) },
          ])
        );
    }
    navegar(intencion, "");
  };

  /**
   * **Elegir la cuenta** cuando el nombre era ambiguo (`ir-cuenta`): navega a la
   * cuenta y aprende el término (ámbito `cuenta`, el mismo que usan los campos).
   */
  const elegirCuenta = (opcion: OpcionVoz) => {
    const termino = preguntaCuenta?.termino ?? "";
    const destino = INTENCIONES.find((i) => i.id === "ir-cuenta");
    setPreguntaCuenta(null);
    if (!destino) return;
    if (termino) {
      void voz
        ?.aprender({
          ambito: "cuenta",
          termino,
          destinoValor: opcion.value,
          destinoEtiqueta: opcion.label,
          origen: "ambiguedad",
        })
        .then(() =>
          voz?.registrarUsos([{ ambito: "cuenta", terminoNorm: norm(termino) }])
        );
    }
    navegar(destino, "", opcion.value);
  };

  /** Arranca una sesión de dictado nueva. */
  const iniciar = () => {
    huboError.current = false;
    sesion.current = iniciarDictado({
      lang: VOZ_LANG,
      onEstado: (e) => {
        setEstado(e);
        if (e === "listo") sesion.current = null;
      },
      onError: (e) => {
        huboError.current = true;
        setAviso({ texto: MENSAJE_ERROR[e] });
      },
      // Texto reconocido: se resuelve (navega o burbuja con lo escuchado).
      onTexto: interpretar,
      // La sesión terminó sin reconocer nada: sin este aviso el usuario no veía
      // NADA (ni burbuja ni error) y parecía que el FAB no hacía nada.
      onSinTexto: () => {
        if (huboError.current) return;
        setAviso(SIN_TEXTO);
      },
    });
  };

  /**
   * Un solo toque hace todo: arranca, y si ya estaba escuchando **corta**.
   *
   * ⚠️ Acá **no** se toca el micrófono antes de arrancar (`getUserMedia`,
   * `AudioContext`…): se probó el 2026-09-23 y en iOS deja la sesión **peor**
   * (pasó a no captar en ninguna pulsación; ver bitácora §151-§152). El motor ya
   * hace su propia preparación dentro del gesto, sin `await`.
   *
   * ℹ️ **Consecuencia aceptada**: en Safari/iOS el **primer** dictado después de
   * cargar la página puede quedar mudo (bug de la *audio session* de WebKit,
   * §143); a partir del segundo funciona. Se decidió **no** seguir peleando con
   * eso: es tolerable.
   */
  const alTocar = () => {
    // Segundo toque mientras escucha: corta y entrega lo reconocido hasta ahí.
    if (sesion.current) {
      sesion.current.detener();
      return;
    }
    setAviso(null);
    if (!soporteVoz().disponible) {
      setAviso({ texto: MENSAJE_ERROR["no-soportado"] });
      return;
    }
    iniciar();
  };

  const tap = useTap(alTocar);

  /**
   * Dictado que **ya viene resuelto de otra pantalla**: el sobrante que dejó el
   * FAB al navegar (`llevaTexto`, D10) o el `?dicho=` del Atajo de Apple.
   *
   * Depende de `pantalla` a propósito: se aplica recién cuando la pantalla destino
   * se registró, y **una sola vez** (si no, al tipear se volvería a aplicar).
   */
  useEffect(() => {
    if (!pantalla) return;
    const pendiente = tomarTexto() || (dichoUsado.current ? "" : dicho);
    if (!pendiente) return;
    dichoUsado.current = true;
    void llenar(pendiente);
  }, [pantalla, dicho, llenar]);

  /**
   * Campos vigentes para leer los chips: los de la pantalla actual y, si ya no
   * está (paso de confirmación del wizard), los que viajaron con el dictado.
   */
  const camposVigentes = pantalla?.config.campos ?? dictado?.campos ?? [];

  /** Config del campo que se está mostrando (para etiqueta y formato). */
  const campoDe = (nombre: string): CampoDictable | undefined =>
    buscarCampo(camposVigentes, nombre);

  /** Valor presentable de una asignación (monto con $, fecha dd/mm/aaaa, etiqueta). */
  const valorLindo = (a: Asignacion): string => {
    const campo = campoDe(a.campo);
    if (!campo) return String(a.valor);
    if (campo.tipo === "monto") {
      return `$ ${Number(a.valor).toLocaleString("es-AR")}`;
    }
    if (campo.tipo === "fecha") {
      const [y, m, d] = String(a.valor).split("-");
      return `${d}/${m}/${y}`;
    }
    if (campo.tipo === "opcion") {
      const opcion = campo.opciones?.().find((o) => o.value === String(a.valor));
      return opcion?.label ?? String(a.valor);
    }
    return String(a.valor);
  };

  /** Aclaración chica: de dónde salió el valor (no siempre de la frase). */
  const notaDe = (a: Asignacion): string | undefined => {
    if (a.origen === "historial") return "del último gasto";
    if (a.origen === "alias") return "ya lo sabía";
    return undefined;
  };

  /** ✕ de un chip: vuelve **ese** campo a como estaba antes del dictado. */
  const quitarCampo = (campo: string) => {
    if (!dictado || !pantalla) return;
    pantalla.escribir({ [campo]: dictado.antes[campo] });
    const asignaciones = dictado.resultado.asignaciones.filter(
      (a) => a.campo !== campo
    );
    setDictado({
      ...dictado,
      resultado: { ...dictado.resultado, asignaciones },
      // Ese término ya no resolvió nada en este dictado: no debe contar como uso.
      usos: usosDeDictado(
        { ...dictado.resultado, asignaciones },
        dictado.campos,
        voz?.filas ?? []
      ),
    });
  };

  /** Deshacer **todo** el último dictado (1 nivel). */
  const deshacerTodo = () => {
    if (!dictado) return;
    pantalla?.escribir(dictado.antes);
    setDictado(null);
  };

  const tapDeshacer = useTap(deshacerTodo);
  const tapAprendido = useTap(() => setVerAprendido(true));

  /**
   * Fila **aprendida** que produjo el valor de esta asignación (si la hay).
   * Sirve para ofrecer **olvidar** justo en el chip del término que se resolvió
   * con lo que la app "ya sabía" (R11).
   */
  const filaAprendidaDe = (a: Asignacion): AliasVozOut | undefined =>
    filaPropiaDe(a, camposVigentes, voz?.filas ?? []);

  /** Olvidar el término que resolvió este chip (vuelve al comportamiento difuso). */
  const olvidarDe = (a: Asignacion) => {
    const campo = campoDe(a.campo);
    const fila = filaAprendidaDe(a);
    if (!campo?.catalogo || !fila) return;
    void voz?.olvidarPorTermino({
      ambito: campo.catalogo,
      terminoNorm: fila.terminoNorm,
    });
    toast.success(`Olvidé que «${fila.termino}» era ${fila.destinoEtiqueta}`);
  };

  /**
   * Elegir un candidato: aplica ese valor y **aprende** (vía A del plan de G2).
   * Aprende por **catálogo** (R12), con el término que produjo la ambigüedad.
   */
  const elegirCandidato = (c: Candidato, opcion: OpcionVoz) => {
    if (!pantalla) return;
    const campo = campoDe(c.campo);
    const valor = campo?.numerico ? Number(opcion.value) : opcion.value;
    // `escribir` devuelve el "antes": lo guardamos para que el chip que se agrega
    // abajo también sepa a qué valor volver.
    const antes = pantalla.escribir({ [c.campo]: valor });
    if (campo?.catalogo) {
      void voz?.aprender({
        ambito: campo.catalogo,
        termino: c.termino,
        destinoValor: opcion.value,
        destinoEtiqueta: opcion.label,
        origen: "ambiguedad",
      });
    }
    // Lo elegido también resolvió un término con catálogo ⇒ entra como chip y
    // cuenta como uso si el usuario guarda.
    const asignacion: Asignacion = {
      campo: c.campo,
      valor,
      texto: c.termino,
      origen: "alias",
      puntaje: 1,
    };
    setDictado((d) => {
      if (!d) return d;
      const asignaciones = [
        ...d.resultado.asignaciones.filter((x) => x.campo !== c.campo),
        asignacion,
      ];
      // ⚠️ El par del alias recién aprendido se agrega **a mano**: la capa
      // aprendida se actualiza de forma **optimista y asincrónica**, así que en
      // este instante `voz.filas` todavía no lo tiene y `usosDeDictado` no lo
      // vería (era el bug de `usos: 0`).
      const par = campo?.catalogo
        ? { ambito: campo.catalogo, terminoNorm: norm(c.termino) }
        : null;
      const usos = [...usosDeDictado({ ...d.resultado, asignaciones }, d.campos, voz?.filas ?? [])];
      if (par && !usos.some((u) => u.ambito === par.ambito && u.terminoNorm === par.terminoNorm)) {
        usos.push(par);
      }
      return {
        ...d,
        antes: { ...d.antes, ...antes },
        resultado: {
          ...d.resultado,
          asignaciones,
          candidatos: d.resultado.candidatos.filter((x) => x.campo !== c.campo),
        },
        usos,
      };
    });
  };

  // Al abandonar la página hay que soltar el micrófono: una sesión viva deja el
  // micrófono tomado y en iOS la carga siguiente no captura (bitácora §143-§144).
  useEffect(() => {
    const soltar = () => {
      sesion.current?.detener();
      sesion.current = null;
    };
    window.addEventListener("pagehide", soltar);
    return () => {
      window.removeEventListener("pagehide", soltar);
      soltar();
    };
  }, []);

  /**
   * **El FAB se hace a un lado cuando puede tapar la acción primaria.**
   *
   * El `rootMargin` inferior recorta el viewport en la franja del FAB (7rem),
   * así que un pie marcado con `data-pie-accion` (el de los wizards y el de los
   * `CrudForm`) "interseca" exactamente mientras estaría debajo del FAB ―sea
   * scrolleando o al llegar al final―. Reemplaza la reserva de espacio, que no
   * alcanzaba cuando el pie pasa por la franja a mitad del scroll.
   *
   * ⚠️ La franja se **mide** (ver `conectar`): si se recorta sólo el borde
   * inferior, cualquier pie visible en la parte baja de la pantalla "interseca"
   * y el FAB desaparece **sin estar debajo** (en escritorio, con el pie a la vista
   * desde el arranque, el FAB no aparecía nunca ⇒ no se podía dictar ni responder
   * una pregunta del dictado).
   */
  useEffect(() => {
    let io: IntersectionObserver | null = null;
    const conectar = () => {
      io?.disconnect();
      const pies = document.querySelectorAll("[data-pie-accion]");
      if (!pies.length) return;
      // **Franja real del FAB**, no todo el viewport: se recorta el root a la
      // banda que ocupa el botón. El botón es el último hijo del contenedor (que
      // está anclado abajo), así que su borde inferior es estable aunque la
      // burbuja esté abierta.
      const rect = botonRef.current?.getBoundingClientRect();
      const abajo = Math.round(
        (rect ? window.innerHeight - rect.bottom : 16) - MARGEN_FRANJA
      );
      const arriba = Math.round(
        window.innerHeight - abajo - (rect?.height ?? 52) - MARGEN_FRANJA
      );
      io = new IntersectionObserver(
        (entradas) => setCeder(entradas.some((e) => e.isIntersecting)),
        { rootMargin: `${arriba}px 0px -${abajo}px 0px` }
      );
      pies.forEach((p) => io?.observe(p));
    };
    conectar();
    // Los pies pueden montarse después del cambio de ruta (pasos del wizard) y la
    // franja depende del tamaño de la ventana.
    const t = setTimeout(conectar, 700);
    window.addEventListener("resize", conectar);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", conectar);
      io?.disconnect();
    };
  }, [ruta]);

  const ejemplos = INTENCIONES.filter((i) => i.ejemplo);

  return (
    <div
      className={cn(
        "fp-voz-fab fixed right-4 z-40 flex flex-col items-end gap-2",
        "transition-opacity duration-200",
        // Se corre mientras hay una acción primaria debajo (ver el observer).
        ceder && "pointer-events-none opacity-0"
      )}
      aria-hidden={ceder || undefined}
    >
      {/* Pregunta de **navegación** (§15.6): la orden se entendió, el destino no.
          Un botón por destino; el elegido **navega** y (si había un término
          significativo) **se aprende** para la próxima. */}
      {preguntaNav && (
        <div
          role="status"
          className="relative w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-background p-3 shadow-lg"
        >
          <BotonCerrar onCerrar={() => setPreguntaNav(null)} />
          <p className="pr-8 text-[12.5px] text-card-foreground">
            ¿A dónde querés ir?
          </p>
          {preguntaNav.termino && (
            <p className="mt-1 text-[12.5px] text-subtitle">
              Todavía no sé donde queda «{preguntaNav.termino}».
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {preguntaNav.destinos.map((i, k) => (
              <BotonCandidato
                key={i.id}
                indice={k}
                texto={i.etiqueta ?? i.id}
                onElegir={() => elegirDestino(i)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Cuenta **ambigua** (`ir-cuenta`): "galicia" puede ser ARS o USD. Elegir
          navega (`/cuentas/[id]`) y aprende el término. */}
      {preguntaCuenta && (
        <div
          role="status"
          className="relative w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-background p-3 shadow-lg"
        >
          <BotonCerrar onCerrar={() => setPreguntaCuenta(null)} />
          <p className="pr-8 text-[12.5px] text-card-foreground">
            {preguntaCuenta.sinResolver
              ? "No conozco esa cuenta. ¿Cuál de estas?"
              : "¿Cuál de estas cuentas?"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {preguntaCuenta.opciones.map((o, k) => (
              <BotonCandidato
                key={o.value}
                indice={k}
                texto={o.label}
                onElegir={() => elegirCuenta(o)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Burbuja pegada al FAB (R8) */}
      {aviso && (
        <div
          role="status"
          className="relative w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-background p-3 shadow-lg"
        >
          <BotonCerrar onCerrar={() => setAviso(null)} />
          <p className="pr-8 text-[12.5px] text-card-foreground">{aviso.texto}</p>
          {aviso.escuchado && (
            <p className="mt-1 text-[12.5px] text-subtitle">
              Escuché: «{aviso.escuchado}»
            </p>
          )}

          {ejemplos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ejemplos.map((i) => (
                <EjemploVoz
                  key={i.id}
                  texto={i.ejemplo ?? ""}
                  onElegir={interpretar}
                />
              ))}
            </div>
          )}

          {aprendidas.length > 0 && (
            <div className="mt-2.5 flex">
              <button
                type="button"
                aria-label="Lo que aprendí"
                title="Lo que aprendí"
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-subtitle active:bg-muted"
                {...tapAprendido}
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Resultado del último dictado (G3): chips con ✕ por campo, candidatos
          para la ambigüedad y Deshacer de todo (1 nivel). */}
      {dictado && !aviso && !preguntaNav && !preguntaCuenta && (
        <div
          role="status"
          className="relative w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-background p-3 shadow-lg"
        >
          <BotonCerrar onCerrar={() => setDictado(null)} />
          <p className="pr-8 text-[12.5px] text-card-foreground">
            {dictado.resultado.candidatos.length
              ? dictado.resultado.asignaciones.length
                ? `Completé ${
                    dictado.resultado.asignaciones.length === 1
                      ? "1 campo"
                      : `${dictado.resultado.asignaciones.length} campos`
                  }. Elegí lo que falta:`
                : "Para seguir necesito que elijas una opción:"
              : `Completé ${
                  dictado.resultado.asignaciones.length === 1
                    ? "1 campo"
                    : `${dictado.resultado.asignaciones.length} campos`
                }. Revisalos y guardá vos.`}
          </p>

          {/* La **pregunta** va primero: es lo único que falta decidir. */}
          {dictado.resultado.candidatos.map((c) => (
            <div key={c.campo} className="mt-2.5">
              <p className="text-[11.5px] font-medium text-header">
                ¿Cuál es {campoDe(c.campo)?.etiqueta?.toLowerCase() ?? c.campo}?
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {c.opciones.map((o, k) => (
                  <BotonCandidato
                    key={o.value}
                    indice={k}
                    texto={o.label}
                    onElegir={() => elegirCandidato(c, o)}
                  />
                ))}
              </div>
            </div>
          ))}

          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1.5">
            {dictado.resultado.asignaciones.map((a) => (
              <ChipVoz
                key={a.campo}
                etiqueta={campoDe(a.campo)?.etiqueta ?? a.campo}
                valor={valorLindo(a)}
                nota={notaDe(a)}
                onQuitar={() => quitarCampo(a.campo)}
                onOlvidar={
                  filaAprendidaDe(a) ? () => olvidarDe(a) : undefined
                }
              />
            ))}
          </div>

          {dictado.resultado.noEntendido.length > 0 && (
            <p className="mt-2 text-[11px] text-subtitle">
              No entendí: «{dictado.resultado.noEntendido.join(" ")}»
            </p>
          )}

          {/* Regla 7 (§15.4): lo implícito no pisa ⇒ se dice qué **no** se tocó. */}
          {dictado.resultado.omitidos.length > 0 && (
            <p className="mt-2 text-[11px] text-subtitle">
              No toqué {listar(dictado.resultado.omitidos)}: ya tenía
              {dictado.resultado.omitidos.length === 1 ? "" : "n"} valor.
            </p>
          )}

          <div className="mt-2.5 flex items-center gap-3">
            <button
              type="button"
              aria-label="Deshacer el dictado"
              title="Deshacer"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-subtitle active:bg-muted"
              {...tapDeshacer}
            >
              <Undo2 className="h-4 w-4" />
            </button>
            {aprendidas.length > 0 && (
              <button
                type="button"
                aria-label="Lo que aprendí"
                title="Lo que aprendí"
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-subtitle active:bg-muted"
                {...tapAprendido}
              >
                <Settings className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* «Lo que aprendí» (R11): lista compacta, **no** es un CRUD (no se crean
          alias a mano). Se abre con el ⋯ de las burbujas. */}
      <Modal
        open={verAprendido}
        onClose={() => setVerAprendido(false)}
        title="Lo que aprendí"
        centrado
      >
        {aprendidas.length === 0 ? (
          <p className="text-[12.5px] text-subtitle">
            Todavía no aprendí nada tuyo. Cuando el FAB te pregunte y elijas una
            opción —o cuando corrijas un campo que llené— lo voy a recordar.
          </p>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
            {aprendidas.map((f) => (
              <FilaAprendida
                key={f.id}
                termino={f.termino}
                destino={f.destinoEtiqueta}
                catalogo={etiquetaAmbito(f.ambito)}
                usos={f.usos}
                onOlvidar={() => voz?.olvidar(f.id)}
              />
            ))}
          </ul>
        )}
      </Modal>

      <button
        type="button"
        ref={botonRef}
        aria-label={escuchando ? "Detener el dictado" : "Dictar por voz"}
        title={escuchando ? "Escuchando…" : "Dictar"}
        className={cn(
          "relative flex h-13 w-13 items-center justify-center rounded-full shadow-lg",
          "transition-transform active:scale-95",
          // `touch-none`: el gesto no scrollea ni dispara el pull-to-refresh (el FAB
          // igual queda fuera del <main>, esto es defensivo); `select-none` +
          // highlight transparente evitan el destello/la selección al mantener.
          "touch-none select-none [-webkit-tap-highlight-color:transparent]",
          escuchando ? "bg-danger text-white" : "bg-header text-background"
        )}
        // `useTap`: en iOS el `click` puede no llegar (bitácora §119).
        {...tap}
      >
        {escuchando && (
          <span
            className="fp-voz-pulso absolute inset-0 rounded-full bg-danger"
            aria-hidden="true"
          />
        )}
        <Mic className="relative h-5.5 w-5.5" />
      </button>
    </div>
  );
}

/**
 * **✕ de la burbuja**, en el ángulo superior derecho: es el mismo gesto de cierre
 * que usan los popups de la app (`ui/modal.tsx`), pedido por el usuario el
 * 2026-09-24 (antes era un link "Cerrar" al pie, de 11 px y sin área de toque).
 *
 * `absolute` ⇒ la burbuja que lo monta tiene que ser `relative` y **su primera
 * línea** lleva `pr-8` para no pasar por debajo.
 */
function BotonCerrar({ onCerrar }: { onCerrar: () => void }) {
  const tap = useTap(onCerrar);
  return (
    <button
      type="button"
      aria-label="Cerrar"
      title="Cerrar"
      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-subtitle active:bg-muted"
      {...tap}
    >
      <X className="h-4 w-4" />
    </button>
  );
}

/**
 * Ejemplo tocable de la burbuja: al tocarlo se **ejecuta** esa frase (o sea,
 * navega), no se copia el texto. Va en su propio componente para poder usar
 * `useTap` (los hooks no se pueden llamar dentro de un `map`).
 */
function EjemploVoz({
  texto,
  onElegir,
}: {
  texto: string;
  onElegir: (texto: string) => void;
}) {
  const tap = useTap(() => onElegir(texto));
  return (
    <button
      type="button"
      className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11.5px] font-medium text-card-foreground transition-colors active:bg-card"
      {...tap}
    >
      «{texto}»
    </button>
  );
}

/**
 * **Chip de un campo** que el dictado completó, con su **papelera** para volver
 * ese campo al valor que tenía antes. El botón va aparte para poder usar `useTap`
 * (en iOS el `click` puede no llegar, §119).
 *
 * 🗑️ El ícono es `Trash2` (pedido del usuario, 2026-09-24): antes era una ✕, que
 * se leía como "cerrar" y no como "quitar esto".
 */
function ChipVoz({
  etiqueta,
  valor,
  nota,
  onQuitar,
  onOlvidar,
}: {
  etiqueta: string;
  valor: string;
  nota?: string;
  onQuitar: () => void;
  /** Solo si el valor salió de un alias **propio** (R11). */
  onOlvidar?: () => void;
}) {
  const tap = useTap(onQuitar);
  return (
    <span className="inline-flex items-center gap-0.5">
      <ChipAsignacion etiqueta={etiqueta} valor={valor} nota={nota} />
      {onOlvidar && <BotonOlvidar onOlvidar={onOlvidar} />}
      <button
        type="button"
        aria-label={`Quitar ${etiqueta}`}
        title="Volver a como estaba"
        className="flex h-5 w-5 items-center justify-center rounded-full text-subtitle active:bg-muted"
        {...tap}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

/**
 * **Olvidar** el término que la app "ya sabía": vuelve al comportamiento difuso
 * (la próxima vez vuelve a preguntar). Va en el chip y en la lista (R11).
 */
function BotonOlvidar({ onOlvidar }: { onOlvidar: () => void }) {
  const tap = useTap(onOlvidar);
  return (
    <button
      type="button"
      aria-label="Olvidar este término"
      title="Olvidar este término"
      className="flex h-4 items-center rounded-full px-1 text-[10px] text-subtitle underline active:bg-muted"
      {...tap}
    >
      olvidar
    </button>
  );
}

/** Fila de «Lo que aprendí»: término · catálogo · destino · usos · olvidar. */
function FilaAprendida({
  termino,
  destino,
  catalogo,
  usos,
  onOlvidar,
}: {
  termino: string;
  destino: string;
  catalogo: string;
  usos: number;
  onOlvidar: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-[12.5px] text-header">
          «{termino}» → {destino}
        </p>
        <p className="text-[11px] text-subtitle">
          {catalogo} · {usos === 1 ? "1 uso" : `${usos} usos`}
        </p>
      </div>
      <BotonOlvidar onOlvidar={onOlvidar} />
    </li>
  );
}

/**
 * Opción tocable de una pregunta ("¿Cuál es categoría?"): elegirla **aprende**.
 *
 * 🎨 El color del tinte lo define la **posición** en la lista (`indice`): las
 * opciones de una misma pregunta se ven de colores distintos, semitransparentes.
 */
function BotonCandidato({
  texto,
  indice,
  onElegir,
}: {
  texto: string;
  /** Posición en la lista de opciones (define el color). */
  indice: number;
  onElegir: () => void;
}) {
  const tap = useTap(onElegir);
  return (
    <button
      type="button"
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors active:opacity-70",
        colorOpcion(indice)
      )}
      {...tap}
    >
      {texto}
    </button>
  );
}
