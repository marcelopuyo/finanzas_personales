/**
 * Parser de **campos**: texto dictado + `ConfigDictado` → valores parciales del
 * formulario. Es el corazón del dictado por pantalla y del traspaso del dictado
 * global (el FAB navega, la pantalla destino parsea el sobrante).
 *
 * Orden de resolución (de lo determinista a lo heurístico):
 *   1. **Disparadores explícitos** ("descripción …", "monto …") — mandan sobre todo.
 *   2. **Números** → el campo `monto` (si hay varios, gana el mayor).
 *   3. **Fechas** → el campo `fecha`.
 *   4. **Opciones** → sinónimos declarados y después match difuso; si hay
 *      ambigüedad **no elige** y devuelve candidatos (D6).
 *   5. **Resto** → el campo `texto`, sin el relleno inicial.
 *
 * ⚠️ Nunca guarda nada: solo devuelve valores para que el formulario los muestre
 * y el usuario decida.
 */

import { MARGEN_GANADOR, MAX_CANDIDATOS, MAX_TOKENS_TEXTO, RELLENO_INICIAL, UMBRAL_OPCION } from "./config";
import { extraerFechas } from "./fechas";
import { extraerNumeros, numeroMayor } from "./numeros";
import { norm, tokenizar } from "./normalizar";
import { buscarOpciones, buscarSinonimo } from "./opciones";
import type {
  Asignacion,
  CampoDictable,
  Candidato,
  ConfigDictado,
  OrigenAsignacion,
  ResultadoDictado,
} from "./tipos";

/** Primera letra en mayúscula, el resto como vino del reconocedor. */
function capitalizar(texto: string): string {
  if (!texto) return "";
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Tramo de la frase: o es "libre" (sin disparador) o pertenece a un campo. */
interface Zona {
  campo: CampoDictable | null;
  desde: number;
  hasta: number;
}

export function parsearCampos(texto: string, config: ConfigDictado): ResultadoDictado {
  const orig = tokenizar(texto);
  const nrm = orig.map(norm);
  const N = orig.length;

  /** Token consumido estructuralmente (no se puede reasignar). */
  const usado: boolean[] = orig.map(() => false);
  /** Token que **no** puede formar parte de la Descripción (números, fechas, disparadores). */
  const noTexto: boolean[] = orig.map(() => false);

  const asignado = new Set<string>();
  const asignaciones: Asignacion[] = [];
  const candidatos: Candidato[] = [];

  const campoMonto = config.campos.find((c) => c.tipo === "monto");
  const campoFecha = config.campos.find((c) => c.tipo === "fecha");
  const campoTexto = config.campos.find((c) => c.tipo === "texto");

  const marcar = (desde: number, hasta: number, bloqueaTexto = true) => {
    for (let i = desde; i <= hasta; i++) {
      usado[i] = true;
      if (bloqueaTexto) noTexto[i] = true;
    }
  };

  const asignar = (
    campo: CampoDictable,
    valor: string | number,
    textoAsig: string,
    origen: OrigenAsignacion,
    puntaje = 1
  ): boolean => {
    if (asignado.has(campo.campo)) return false;
    asignado.add(campo.campo);
    asignaciones.push({
      campo: campo.campo,
      valor: campo.numerico ? Number(valor) : valor,
      texto: textoAsig,
      origen,
      puntaje,
    });
    return true;
  };

  /** Índices de los tokens libres (los que ningún paso consumió). */
  const libres = () => {
    const out: number[] = [];
    for (let i = 0; i < N; i++) if (!usado[i]) out.push(i);
    return out;
  };
  /** Índices de una zona, excluyendo lo ya consumido. */
  const libresDeZona = (z: Zona) => {
    const out: number[] = [];
    for (let i = z.desde; i <= z.hasta; i++) if (!usado[i]) out.push(i);
    return out;
  };

  /**
   * Marca como consumido el tramo que produjo un match (1 o 2 palabras).
   *
   * `aportaTexto` dice si el match **también** puede ser la Descripción: en
   * Categoría sí ("gasté mil en el supermercado" → categoría + descripción
   * "Supermercado"), en Cuenta no ("Santander" no describe un gasto).
   */
  const marcarTermino = (termino: string, aportaTexto: boolean) => {
    const partes = termino.split(" ").filter(Boolean);
    for (let i = 0; i + partes.length <= N; i++) {
      let ok = true;
      for (let k = 0; k < partes.length; k++) {
        if (usado[i + k] || nrm[i + k] !== partes[k]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        marcar(i, i + partes.length - 1, !aportaTexto);
        return;
      }
    }
  };

  // ── 1) Disparadores explícitos ─────────────────────────────────────────────
  const disparos: { campo: CampoDictable; desde: number; hasta: number }[] = [];
  for (let i = 0; i < N; i++) {
    let hit: { campo: CampoDictable; hasta: number } | null = null;
    for (const campo of config.campos) {
      for (const d of campo.disparadores ?? []) {
        const partes = tokenizar(d).map(norm);
        if (partes.length && partes.every((p, k) => nrm[i + k] === p)) {
          hit = { campo, hasta: i + partes.length - 1 };
          break;
        }
      }
      if (hit) break;
    }
    if (hit) {
      disparos.push({ campo: hit.campo, desde: i, hasta: hit.hasta });
      i = hit.hasta;
    }
  }

  // Zonas: el texto entre un disparador y el siguiente pertenece a ese campo.
  const zonas: Zona[] = [];
  if (!disparos.length) {
    zonas.push({ campo: null, desde: 0, hasta: N - 1 });
  } else {
    if (disparos[0].desde > 0) {
      zonas.push({ campo: null, desde: 0, hasta: disparos[0].desde - 1 });
    }
    disparos.forEach((d, k) => {
      const desde = d.hasta + 1;
      const hasta = k + 1 < disparos.length ? disparos[k + 1].desde - 1 : N - 1;
      if (hasta >= desde) zonas.push({ campo: d.campo, desde, hasta });
      marcar(d.desde, d.hasta); // la palabra disparadora no es contenido
    });
  }

  // ── 2 y 3) Números y fechas ────────────────────────────────────────────────
  for (const z of zonas) {
    const tokensZona = orig.slice(z.desde, z.hasta + 1);
    const fechaDefault = z.campo !== null && z.campo.tipo === "fecha";
    const montoDefault = z.campo !== null && z.campo.tipo === "monto";

    // Números
    if ((z.campo === null && campoMonto) || montoDefault) {
      const campoDestino = z.campo ?? campoMonto;
      const mejor = numeroMayor(extraerNumeros(tokensZona));
      if (campoDestino && mejor) {
        const origen: OrigenAsignacion = z.campo ? "disparador" : "numero";
        if (asignar(campoDestino, mejor.valor, mejor.texto, origen)) {
          marcar(z.desde + mejor.desde, z.desde + mejor.hasta);
        }
      }
    }

    // Fechas
    if ((z.campo === null && campoFecha) || fechaDefault) {
      const campoDestino = z.campo ?? campoFecha;
      const primera = extraerFechas(tokensZona)[0];
      if (campoDestino && primera) {
        const origen: OrigenAsignacion = z.campo ? "disparador" : "fecha";
        if (asignar(campoDestino, primera.fecha, primera.texto, origen)) {
          marcar(z.desde + primera.desde, z.desde + primera.hasta);
        }
      }
    }
  }

  // ── 4) Campos de opción ────────────────────────────────────────────────────
  for (const campo of config.campos.filter((c) => c.tipo === "opcion")) {
    if (asignado.has(campo.campo)) continue;
    const opciones = campo.opciones?.() ?? [];
    if (!opciones.length) continue;

    const zona = zonas.find((z) => z.campo === campo);
    const idx = zona ? libresDeZona(zona) : libres();
    if (!idx.length) continue;

    const sin = buscarSinonimo(
      idx.map((i) => nrm[i]),
      campo,
      opciones
    );
    if (sin) {
      asignar(campo, sin.opcion.value, sin.termino, "sinonimo", sin.puntaje);
      marcarTermino(norm(sin.termino), Boolean(campo.aportaTexto));
      continue;
    }

    const textoLibre = idx.map((i) => orig[i]).join(" ");
    const matches = buscarOpciones(textoLibre, opciones).filter(
      (m) => m.puntaje >= UMBRAL_OPCION
    );
    if (!matches.length) continue;

    const [primero, segundo] = matches;
    if (!segundo || primero.puntaje - segundo.puntaje >= MARGEN_GANADOR) {
      asignar(campo, primero.opcion.value, primero.opcion.label, "opcion", primero.puntaje);
      marcarTermino(primero.termino, Boolean(campo.aportaTexto));
    } else {
      candidatos.push({
        campo: campo.campo,
        opciones: matches.slice(0, MAX_CANDIDATOS).map((m) => m.opcion),
      });
    }
  }

  // ── 5) Descripción (el resto) ──────────────────────────────────────────────
  if (campoTexto && !asignado.has(campoTexto.campo)) {
    const zonaTexto = zonas.find((z) => z.campo === campoTexto);
    let valor = "";

    if (zonaTexto) {
      // El usuario dijo "descripción …": se respeta ese tramo tal cual.
      const idx = libresDeZona(zonaTexto);
      valor = capitalizar(idx.map((i) => orig[i]).join(" ").trim());
      idx.forEach((i) => (usado[i] = true));
    } else {
      // Texto libre: todo lo que no sea número, fecha ni palabra disparadora.
      // Lo que sí entra son los matches de opción que `aportaTexto` (Categoría),
      // para que "en el supermercado" deje además "Supermercado" de descripción.
      const idx: number[] = [];
      for (let i = 0; i < N; i++) if (!noTexto[i]) idx.push(i);
      let k = 0;
      while (k < idx.length && RELLENO_INICIAL.has(nrm[idx[k]])) k++;
      const utiles = idx.slice(k);
      // Una frase larga que no matcheó nada es ruido, no una descripción.
      if (utiles.length <= MAX_TOKENS_TEXTO) {
        valor = capitalizar(utiles.map((i) => orig[i]).join(" ").trim());
        idx.forEach((i) => (usado[i] = true));
      }
    }

    if (valor) asignar(campoTexto, valor, valor, "resto", 0.8);
  }

  // ── Salida ────────────────────────────────────────────────────────────────
  const valores: Record<string, string | number> = {};
  for (const a of asignaciones) valores[a.campo] = a.valor;

  const sobrantes = orig.filter((_, i) => !usado[i]);
  const noEntendido =
    asignaciones.length === 0 && orig.length ? orig : sobrantes;

  return { valores, asignaciones, candidatos, noEntendido };
}
