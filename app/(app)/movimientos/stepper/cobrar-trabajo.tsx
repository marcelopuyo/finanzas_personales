"use client";

// Paso del wizard: **Cobrar trabajo** (rebanada R2 de plan-liquidaciones.md).
// Es el único lugar donde nace una LIQUIDACIÓN: el cobro declara el período
// (`fijo`/`horas_fijas`) o selecciona ítems pendientes (`horas_variables`/`por_tarea`),
// y la liquidación queda cerrada con su `montoCalculado` y su `montoCobrado` (que
// puede diferir: el monto es editable — P2).
//
// **Orden de pantallas (2026-09-26, pedido del usuario).** La primera decisión es
// el TRABAJO a cobrar y, según su modalidad:
//  · `horas_variables` / `por_tarea` → **sub-paso 1**: tildar las jornadas/tareas
//    (todas premarcadas) · **sub-paso 2**: fecha del día + cuenta + monto
//    **precargado** con lo calculado (editable).
//  · `fijo` / `horas_fijas` → **una sola pantalla** con las opciones generales
//    (rango declarado y, en horas fijas, las horas) + fecha + cuenta + monto.
// Después sigue la CONFIRMACIÓN (paso del wizard) y el guardado.
// Se entra desde el ⋯ de `/trabajo` (modo directo: `/movimientos/nuevo/cobro`) o
// desde el stepper `/movimientos`.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMovimientoStepper } from "./stepper-context";
import {
  StepShell,
  NavButtons,
  DateField,
  SelectField,
  NumberField,
  Fila,
  formatFecha,
} from "./ui";
import { Checkbox } from "@/components/ui/checkbox";
import { decimalToTime, numberToCurrency } from "@/lib/utils";
import { STEP_CONFIRMACION, type MovimientoData } from "./types";
import {
  ETIQUETA_MODALIDAD,
  idsDeItems,
  itemsDelTrabajo,
  modalidadDeclarada,
  seleccionDeItems,
} from "./cobro-items";
import type { ItemPendienteOut } from "@/backend/src/queries/trabajos";
import { useAliasDeCampo } from "@/components/voz/voz-provider";
import {
  useRegistrarPantallaDictable,
  type PantallaDictable,
  type ValoresPantalla,
} from "@/components/voz/dictado-pantalla";
import { aplicarDictadoSimple, escribirEnPantalla } from "./dictado-comun";
import { crearDictadoCobro } from "./dictado-trabajo";

export function CobrarTrabajo() {
  const { data, handleSetData, navigateTo, options } = useMovimientoStepper();
  /**
   * Sub-paso interno del cobro. **El paso 1 es SIEMPRE sólo el TRABAJO**
   * (2026-09-26) y de su modalidad dependen las pantallas siguientes:
   *  · `horas_variables`/`por_tarea` → 1 = qué jornadas/tareas se cobran,
   *    2 = fecha del cobro + cuenta + monto (precargado, editable).
   *  · `fijo`/`horas_fijas` → 1 = opciones generales (rango declarado y, en
   *    horas fijas, las horas) + fecha + cuenta + monto.
   * Después sigue la confirmación del wizard y el guardado.
   */
  const [subpaso, setSubpaso] = useState(0);

  const trabajo = options.trabajos.find((t) => t.id === data.idTrabajo);
  const modalidad = trabajo?.modalidadCobro ?? "";
  // `fijo`/`horas_fijas` no tienen ítems: el rango se declara. El resto se liquida
  // tildando jornadas (horas_variables) o tareas (por_tarea).
  const declarada = modalidadDeclarada(modalidad);
  const esHorasFijas = modalidad === "horas_fijas";
  const items = itemsDelTrabajo(options.itemsPendientes, data.idTrabajo);
  const tildados = [...data.idsJornadas, ...data.idsTareas];
  const jornadasTildadas = items.filter(
    (i) => i.tipo === "jornada" && tildados.includes(i.id)
  );
  const tareasTildadas = items.filter(
    (i) => i.tipo === "tarea" && tildados.includes(i.id)
  );

  // Monto **calculado** (lo que "correspondía"): Σ de los ítems tildados · horas ×
  // precio · el propio monto declarado en `fijo` (ahí calculado = cobrado).
  const calculado = declarada
    ? esHorasFijas
      ? Number((data.horasPeriodo * (trabajo?.precioHora ?? 0)).toFixed(2))
      : data.montoOrigen
    : seleccionDeItems(items, tildados).monto;

  // Etiqueta del trabajo elegido (se muestra como dato en las pantallas siguientes,
  // donde ya no hay selector).
  const etiquetaTrabajo = trabajo
    ? `${trabajo.nombre} — ${ETIQUETA_MODALIDAD[modalidad] ?? modalidad}`
    : "";
  /**
   * Último monto **cobrado** a un trabajo (`0` = nunca se cobró ⇒ **no se
   * precarga nada**, pedido del usuario 2026-09-26). Lo usan las modalidades
   * declaradas (`fijo`/`horas_fijas`), que no tienen ítems de dónde sacarlo.
   */
  const ultimoCobroDe = (idTrabajo: number) =>
    (options.ultimosCobros ?? []).find((u) => u.trabajoId === idTrabajo)?.monto ??
    0;
  const ultimoCobro = ultimoCobroDe(data.idTrabajo);
  const tieneItems = !!trabajo && !declarada;
  /** Pantallas del cobro, sin contar la confirmación del wizard. */
  const totalSubpasos = tieneItems ? 3 : 2;
  const enTrabajo = subpaso === 0;
  const enSeleccion = tieneItems && subpaso === 1;
  const esUltimoSubpaso = subpaso === totalSubpasos - 1;

  /** Datos de la última pantalla (fecha + cuenta + monto). */
  const cobroValido = data.cuentaOrigen > 0 && data.montoOrigen > 0;
  /** `fijo`/`horas_fijas`: el rango declarado y (en horas fijas) las horas. */
  const declaradoValido =
    !!data.fechaDesde &&
    !!data.fechaHasta &&
    data.fechaDesde <= data.fechaHasta &&
    (!esHorasFijas || data.horasPeriodo > 0);

  /** ¿Se puede avanzar desde la pantalla actual? */
  const puedeAvanzar = enTrabajo
    ? data.idTrabajo > 0
    : enSeleccion
      ? tildados.length > 0
      : cobroValido && (!declarada || declaradoValido);

  /** Siguiente: recorre las pantallas y al final pasa a la confirmación. */
  const siguiente = () => {
    if (esUltimoSubpaso) {
      navigateTo(STEP_CONFIRMACION);
      return;
    }
    setSubpaso(subpaso + 1);
  };

  /** Atrás: vuelve una pantalla (en directo no se sale del wizard). */
  const atras = () => {
    if (subpaso > 0) {
      setSubpaso(subpaso - 1);
      return;
    }
    navigateTo(0);
  };

  /** Aplica una selección de ítems: recalcula rango derivado y re-precarga el monto. */
  const aplicarSeleccion = (ids: string[]) => {
    const s = seleccionDeItems(items, ids);
    handleSetData({
      idsJornadas: s.idsJornadas,
      idsTareas: s.idsTareas,
      fechaDesde: s.fechaDesde,
      fechaHasta: s.fechaHasta,
      // El monto vuelve al calculado; después el usuario puede editarlo (la
      // diferencia es sólo un snapshot, no se sigue ni ajusta el ingreso — P2).
      montoOrigen: s.monto,
    });
  };

  /**
   * Elección del trabajo desde la LISTA del paso 1 (2026-09-26): la fila **no
   * tiene estado de selección** — al tocarla se fija el trabajo y se **pasa
   * directo al paso siguiente**. En las variables se tildan TODOS los pendientes
   * (decisión P7: el usuario destilda lo que no quiere cobrar) y en las
   * declaradas se limpia la selección (no liquidan ítems).
   */
  const elegirTrabajo = (id: number) => {
    const t = options.trabajos.find((x) => x.id === id);
    if (!t || modalidadDeclarada(t.modalidadCobro)) {
      // `fijo`/`horas_fijas`: no hay ítems, así que el monto se **precarga con el
      // último cobro del trabajo** (y queda editable). Si nunca se cobró, va 0
      // ⇒ el campo arranca **vacío**.
      handleSetData({
        idTrabajo: id,
        idsJornadas: [],
        idsTareas: [],
        horasPeriodo: 0,
        fechaDesde: "",
        fechaHasta: "",
        montoOrigen: ultimoCobroDe(id),
      });
    } else {
      const pend = itemsDelTrabajo(options.itemsPendientes, id);
      const s = seleccionDeItems(pend, idsDeItems(pend));
      handleSetData({
        idTrabajo: id,
        idsJornadas: s.idsJornadas,
        idsTareas: s.idsTareas,
        fechaDesde: s.fechaDesde,
        fechaHasta: s.fechaHasta,
        montoOrigen: s.monto,
      });
    }
    // La lista avanza sola: no hay que tocar "Siguiente".
    setSubpaso(1);
  };

  /** Destilda/tilda un ítem. */
  const alternarItem = (item: ItemPendienteOut) => {
    aplicarSeleccion(
      tildados.includes(item.id)
        ? tildados.filter((x) => x !== item.id)
        : [...tildados, item.id]
    );
  };

  const tildarTodos = () => aplicarSeleccion(idsDeItems(items));

  const destildarTodos = () =>
    handleSetData({
      idsJornadas: [],
      idsTareas: [],
      fechaDesde: "",
      fechaHasta: "",
      montoOrigen: 0,
    });

  /**
   * **Dictado por voz (2026-09-27)**: la pantalla se declara dictable ante el FAB 🎤.
   *
   * 🔑 El **trabajo** es lo que dispara el flujo: nombrarlo hace lo mismo que
   * tocarlo en la lista (tilda los pendientes, calcula el monto y avanza de
   * sub-paso). Por eso va en `onValores`, que corre **antes** de escribir: lo
   * dictado encima (monto/cuenta/fecha) pisa lo precargado porque es **explícito**.
   *
   * ⚠️ `idTrabajo` se saca de los valores que después escribe el hook: ya lo aplicó
   * `elegirTrabajo()` con sus ítems y sus fechas, y reescribir el id solo dejaría el
   * sub-paso a medias.
   */
  const opcionesCuentaVoz = useMemo(
    () => options.cuentas.map((c) => ({ value: String(c.id), label: c.nombre })),
    [options.cuentas]
  );
  const aliasCuenta = useAliasDeCampo("cuenta", opcionesCuentaVoz);
  const configVoz = useMemo(() => {
    const base = crearDictadoCobro({
      trabajos: options.trabajos.map((t) => ({ id: t.id, nombre: t.nombre })),
      cuentas: options.cuentas.map((c) => ({ id: c.id, nombre: c.nombre })),
    });
    return {
      ...base,
      campos: base.campos.map((campo) =>
        campo.campo === "cuentaOrigen" ? { ...campo, alias: aliasCuenta } : campo
      ),
    };
  }, [options.trabajos, options.cuentas, aliasCuenta]);
  // Los datos frescos sin recrear la pantalla a cada tecla.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  /**
   * Escribe en el wizard, pero **el trabajo pasa primero por `elegirTrabajo()`**: es
   * lo que tilda los pendientes, calcula el monto y avanza de sub-paso (nombrarlo por
   * voz tiene que hacer lo mismo que tocarlo en la lista). El `idTrabajo` se saca de
   * lo que después escribe el wizard para no dejarlo a medias.
   *
   * ⚠️ `elegirTrabajo` va por **ref** y el ref se re-sincroniza en un efecto **sin
   * array de dependencias** (mismo patrón que `lib/tap.ts`): la función se re-crea en
   * cada render y ponerla como dependencia rearmaría el `useCallback` siempre.
   */
  const elegirTrabajoRef = useRef(elegirTrabajo);
  useEffect(() => {
    elegirTrabajoRef.current = elegirTrabajo;
  });
  const escribirVoz = useCallback(
    (valores: ValoresPantalla) => {
      const idTrabajo = Number(valores.idTrabajo ?? 0);
      const actual = Number(
        (dataRef.current as unknown as Record<string, unknown>).idTrabajo ?? 0
      );
      if (idTrabajo > 0 && idTrabajo !== actual) elegirTrabajoRef.current(idTrabajo);
      const resto: ValoresPantalla = { ...valores };
      delete resto.idTrabajo;
      handleSetData(resto as unknown as Partial<MovimientoData>);
    },
    [handleSetData]
  );
  const pantallaVoz = useMemo<PantallaDictable>(
    () => ({
      config: configVoz,
      aplicar: (resultado) =>
        aplicarDictadoSimple(
          resultado,
          configVoz,
          dataRef.current as unknown as Record<string, unknown>,
          escribirVoz
        ),
      escribir: (valores) =>
        escribirEnPantalla(
          valores,
          dataRef.current as unknown as Record<string, unknown>,
          escribirVoz
        ),
    }),
    [configVoz, escribirVoz]
  );
  useRegistrarPantallaDictable(pantallaVoz);

  const etiquetaItem = (i: ItemPendienteOut) => {
    const detalle =
      i.tipo === "jornada"
        ? `${decimalToTime(i.horaDesde ?? 0)} a ${decimalToTime(i.horaHasta ?? 0)}`
        : i.descripcion?.trim() || (i.horas ? `${i.horas} h` : "Tarea");
    const propina =
      i.tipo === "jornada" && i.montoPropina > 0
        ? ` · propina ${numberToCurrency(i.montoPropina)}`
        : "";
    return `${formatFecha(i.fecha)} — ${detalle}${propina} · ${numberToCurrency(i.monto)}`;
  };

  return (
    <StepShell
      title={
        enTrabajo
          ? "Elegí el trabajo que vas a cobrar:"
          : enSeleccion
            ? "Elegí qué jornadas/tareas vas a cobrar:"
            : "Por favor ingrese la información del cobro del trabajo:"
      }
      step={2 + subpaso}
      total={1 + totalSubpasos}
      footer={
        <NavButtons
          onBack={atras}
          onNext={siguiente}
          nextDisabled={!puedeAvanzar}
          // En directo el paso pide "Atrás" porque tiene sub-pasos internos.
          atrasEnDirecto={subpaso > 0}
        />
      }
    >
      {enTrabajo ? (
        /* ── Paso 1: SÓLO el trabajo. Como es la única decisión de la pantalla,
              va como LISTA de opciones (no un `select`): se ve el nombre, la
              modalidad y cuál está elegido de un vistazo. ── */
        options.trabajos.length === 0 ? (
          <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-[12px] text-warning">
            No tenés trabajos cargados. Creá uno desde el menú ⋯ de la pantalla
            (Gestionar trabajos) y volvé a intentar.
          </p>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-muted">
            {options.trabajos.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => elegirTrabajo(t.id)}
                className="flex w-full items-center px-3 py-3 text-left transition-colors hover:bg-card [-webkit-tap-highlight-color:transparent]"
              >
                {/* Sólo el nombre (2026-09-26): la modalidad se ve en la pantalla
                    siguiente, ya con el trabajo elegido. */}
                <span className="min-w-0 flex-1 text-[13.5px] font-medium break-words text-card-foreground">
                  {t.nombre}
                </span>
              </button>
            ))}
          </div>
        )
      ) : enSeleccion ? (
        /* ── Paso 2 (horas variables / por tarea): QUÉ se cobra ── */
        <div className="space-y-2">
          <Fila label="Trabajo" value={etiquetaTrabajo} />
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-card-foreground">
              {modalidad === "por_tarea"
                ? "Tareas a cobrar"
                : "Jornadas a cobrar"}
            </p>
            {items.length > 0 && (
              <button
                type="button"
                onClick={
                  tildados.length === items.length ? destildarTodos : tildarTodos
                }
                className="text-[12px] text-primary hover:underline"
              >
                {tildados.length === items.length
                  ? "Destildar todo"
                  : "Tildar todo"}
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-[12px] text-warning">
              No hay {modalidad === "por_tarea" ? "tareas" : "jornadas"}{" "}
              pendientes de cobro para este trabajo: <b>no se puede cobrar</b>.
              Cargá {modalidad === "por_tarea" ? "una tarea" : "una jornada"} desde
              el ⋯ de la pantalla y volvé a intentar.
            </p>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border bg-card">
              {items.map((i) => (
                <div key={i.id} className="px-3 py-2">
                  <Checkbox
                    checked={tildados.includes(i.id)}
                    onChange={() => alternarItem(i)}
                    label={etiquetaItem(i)}
                  />
                </div>
              ))}
            </div>
          )}

          {(jornadasTildadas.length > 0 || tareasTildadas.length > 0) && (
            <p className="text-[12px] text-subtitle">
              {jornadasTildadas.length > 0 &&
                `${jornadasTildadas.length} jornada${jornadasTildadas.length === 1 ? "" : "s"}`}
              {jornadasTildadas.length > 0 && tareasTildadas.length > 0 && " + "}
              {tareasTildadas.length > 0 &&
                `${tareasTildadas.length} tarea${tareasTildadas.length === 1 ? "" : "s"}`}
              {data.fechaDesde && data.fechaHasta
                ? ` · del ${formatFecha(data.fechaDesde)} al ${formatFecha(data.fechaHasta)}`
                : ""}
            </p>
          )}

          {/* Sin ítems tildados no se puede avanzar ("Siguiente" queda
              deshabilitado): se dice por qué, al lado de la lista. */}
          {items.length > 0 && tildados.length === 0 && (
            <p className="text-[12px] text-warning">
              Tildá al menos una{" "}
              {modalidad === "por_tarea" ? "tarea" : "jornada"} para poder
              cobrar.
            </p>
          )}
        </div>
      ) : (
        /* ── Última pantalla: opciones generales (sólo declaradas) + fecha del
              cobro + cuenta + monto ── */
        <>
          <Fila label="Trabajo" value={etiquetaTrabajo} />
          {declarada && (
            <>
              <DateField
                label="Período desde"
                value={data.fechaDesde}
                onChange={(v) => handleSetData({ fechaDesde: v })}
              />
              <DateField
                label="Período hasta"
                value={data.fechaHasta}
                onChange={(v) => handleSetData({ fechaHasta: v })}
              />
              {esHorasFijas && (
                <NumberField
                  label="Horas del período"
                  value={data.horasPeriodo}
                  onChange={(v) => {
                    // `calculado = horas × precio` (snapshot del precio al cobrar); el
                    // monto se precarga con ese calculado pero queda editable.
                    const nuevo = Number(
                      (v * (trabajo?.precioHora ?? 0)).toFixed(2)
                    );
                    handleSetData({
                      horasPeriodo: v,
                      montoOrigen: nuevo > 0 ? nuevo : data.montoOrigen,
                    });
                  }}
                />
              )}
            </>
          )}

          {tieneItems && (
            <div className="rounded-lg border border-border bg-muted px-3 py-2 text-[12px] leading-5 text-subtitle">
              <p>
                {jornadasTildadas.length > 0 &&
                  `${jornadasTildadas.length} jornada${jornadasTildadas.length === 1 ? "" : "s"}`}
                {jornadasTildadas.length > 0 && tareasTildadas.length > 0 && " + "}
                {tareasTildadas.length > 0 &&
                  `${tareasTildadas.length} tarea${tareasTildadas.length === 1 ? "" : "s"}`}{" "}
                a liquidar
                {data.fechaDesde && data.fechaHasta
                  ? ` · del ${formatFecha(data.fechaDesde)} al ${formatFecha(data.fechaHasta)}`
                  : ""}
              </p>
              <p>
                Calculado:{" "}
                <span className="font-medium text-card-foreground">
                  {numberToCurrency(calculado)}
                </span>
              </p>
            </div>
          )}

          <DateField
            label="Fecha del cobro"
            value={data.fecha}
            onChange={(v) => handleSetData({ fecha: v })}
          />

          <SelectField
            label="Cuenta"
            value={data.cuentaOrigen ? String(data.cuentaOrigen) : ""}
            onChange={(v) => handleSetData({ cuentaOrigen: Number(v) })}
            options={options.cuentas.map((c) => ({
              value: String(c.id),
              label: c.moneda ? `${c.nombre} (${c.moneda.codigoISO})` : c.nombre,
            }))}
          />

          <NumberField
            label="Monto"
            value={data.montoOrigen}
            onChange={(v) => handleSetData({ montoOrigen: v })}
          />

          {/* Precarga del monto declarado (2026-09-26): el último cobro del
              trabajo. Si nunca se cobró, el campo queda vacío. */}
          {declarada && ultimoCobro > 0 && (
            <p className="text-[12px] text-subtitle">
              Precargado con el último cobro ({numberToCurrency(ultimoCobro)}):
              podés editarlo.
            </p>
          )}

          {declarada && esHorasFijas && (
            <p className="text-[12px] text-subtitle">
              Calculado: {data.horasPeriodo} h ×{" "}
              {numberToCurrency(trabajo?.precioHora ?? 0)} ={" "}
              {numberToCurrency(calculado)}
            </p>
          )}
        </>
      )}
    </StepShell>
  );
}
