"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { useMovimientoStepper } from "./stepper-context";
import {
  StepShellFintech,
  HeroeFintech,
  BotonPrincipal,
  DateField,
  SelectField,
  NumberField,
  AutoCompleteField,
} from "./ui";
import { buscarDescripcionesGastoAction } from "../buscar-descripciones";
import { ultimoGastoPorDescripcionAction } from "../ultimo-gasto";
import { STEP_CONFIRMACION, type MovimientoData } from "./types";
import { QuickCreateModal } from "@/components/ui/quick-create-modal";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { crearCategoriaGasto } from "@/backend/src/actions/gastos";
import { crearDictadoGasto } from "./dictado-gasto";
import { useAliasDeCampo } from "@/components/voz/voz-provider";
import {
  useRegistrarPantallaDictable,
  type PantallaDictable,
  type ValoresPantalla,
} from "@/components/voz/dictado-pantalla";
import { simboloMoneda, todayLocalISODate } from "@/lib/utils";
import type { CampoDictable } from "@/lib/voz/tipos";
import { CamaraEscaner } from "@/components/ocr/camara-escaner";
import { extraerTicket, type CamposTicket } from "@/lib/ocr/parsear-ticket";
import { Modal } from "@/components/ui/modal";

/**
 * ¿El formulario **ya tiene** un valor en ese campo?
 *
 * 🔑 Es la mitad de la regla **7** de §15.4 (*"lo implícito no pisa"*): el dictado
 * sólo completa lo que está vacío. La **Fecha** cuenta como vacía mientras siga
 * siendo el día de hoy (es el valor inicial, no una decisión del usuario) ⇒
 * "gasté 500 ayer" sigue actualizando la fecha, pero si el usuario la eligió a
 * mano no se pisa.
 */
function tieneValorEn(
  campo: CampoDictable,
  actuales: Record<string, unknown>
): boolean {
  const actual = actuales[campo.campo];
  if (actual === undefined || actual === null || actual === "" || actual === 0) {
    return false;
  }
  if (campo.tipo === "fecha") return String(actual) !== todayLocalISODate();
  return true;
}

export function GastoDirecto() {
  const { data, handleSetData, navigateTo, options, addCategoriaGasto } =
    useMovimientoStepper();
  // Alta rápida (opción A): texto buscado con el que abre el modal de categoría
  // nueva (null = cerrado).
  const [nuevaCategoria, setNuevaCategoria] = useState<string | null>(null);
  // Overlay que BLOQUEA la pantalla mientras se trae el último gasto.
  const [buscandoUltimo, setBuscandoUltimo] = useState(false);
  /** Escáner del ticket: se abre con el icono de la cabecera y se cierra al leer. */
  const [escanerAbierto, setEscanerAbierto] = useState(false);

  /**
   * ⚠️ **TEMPORAL** (diagnóstico del OCR de tickets, 2026-10-07): el texto crudo de
   * la última lectura, para poder verlo y copiarlo desde el celular y afinar el
   * parser de la descripción con la captura REAL. **Se borra** en cuanto esté
   * afinado (junto con el botón y el modal de abajo).
   */
  const [textoLeido, setTextoLeido] = useState<string | null>(null);
  const [verTexto, setVerTexto] = useState(false);

  /** Envuelve al parser para quedarse con el texto crudo (sólo diagnóstico). */
  const extraerConTexto = useCallback((texto: string) => {
    setTextoLeido(texto);
    return extraerTicket(texto);
  }, []);

  const copiarTexto = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(textoLeido ?? "");
      toast.success("Texto copiado. Pegalo en el chat.");
    } catch {
      toast.error("No se pudo copiar: seleccioná el texto a mano.");
    }
  }, [textoLeido]);

  /**
   * Al ELEGIR una sugerencia de descripción (no al tipear): completa Categoría y
   * Monto con el gasto más reciente que tiene esa descripción. El server devuelve
   * el monto ya convertido a la moneda de la cuenta.
   */
  const handleDescripcionElegida = async (descripcion: string) => {
    setBuscandoUltimo(true);
    try {
      const ultimo = await ultimoGastoPorDescripcionAction({
        descripcion,
        idCuenta: data.cuentaOrigen || undefined,
      });
      if (!ultimo) {
        toast.info("No hay un gasto previo con esa descripción");
        return;
      }
      const patch: Partial<MovimientoData> = {};
      // El **monto** solo se copia si el campo está vacío/0: si el usuario ya
      // cargó un monto mayor que 0, se **respeta** (el héroe manda; pedido
      // 2026-10-01). El resto de lo implícito sigue completando lo que falta.
      const respetaMonto = ultimo.monto > 0 && data.montoOrigen > 0;
      if (ultimo.monto > 0 && !respetaMonto) patch.montoOrigen = ultimo.monto;
      // Solo si esa categoría sigue existiendo (podría estar eliminada).
      if (
        ultimo.categoriaId &&
        options.categoriasGasto.some((c) => c.id === ultimo.categoriaId)
      ) {
        patch.idCategoriaGasto = ultimo.categoriaId;
      }
      if (Object.keys(patch).length === 0) {
        toast.info(
          respetaMonto
            ? "Se respetó el monto que ya cargaste"
            : "Ese gasto no tiene categoría ni monto para copiar"
        );
        return;
      }
      handleSetData(patch);
      toast.success(
        `Se completó con el último gasto "${descripcion}"` +
          (respetaMonto ? " (se respetó tu monto)" : "")
      );
    } catch {
      toast.error("No se pudo recuperar el último gasto");
    } finally {
      setBuscandoUltimo(false);
    }
  };

  /**
   * Aplica lo que salió del **ticket escaneado** (plan OCR §11) **sin pisar lo que
   * el usuario ya cargó** —mismo criterio que el parte de Jornada—: la Descripción
   * sólo si está vacía, la Fecha sólo si sigue siendo la de hoy y el Monto sólo si
   * está en 0.
   *
   * La **Categoría** no está en el ticket: se busca en el historial por el comercio
   * leído (`ultimoGastoPorDescripcionAction`) y, si no hay coincidencia, **queda en
   * blanco** para que la elija el usuario. **Nunca guarda**: eso lo hace el botón
   * del wizard.
   */
  const aplicarTicket = useCallback(
    async (campos: CamposTicket) => {
      setEscanerAbierto(false);

      const patch: Partial<MovimientoData> = {};
      const completados: string[] = [];
      const respetados: string[] = [];

      if (campos.descripcion) {
        if (data.descripcion.trim()) {
          respetados.push("Descripción");
        } else {
          patch.descripcion = campos.descripcion;
          completados.push("Descripción");
        }
      }
      if (campos.fecha) {
        if (data.fecha === todayLocalISODate()) {
          patch.fecha = campos.fecha;
          completados.push("Fecha");
        } else {
          respetados.push("Fecha");
        }
      }
      if (campos.monto !== undefined) {
        if (data.montoOrigen > 0) {
          respetados.push("Monto");
        } else {
          patch.montoOrigen = campos.monto;
          completados.push("Monto");
        }
      }

      // El comercio —el que leyó el OCR o el que el usuario ya había escrito— es la
      // única pista para la categoría.
      const comercio = patch.descripcion ?? data.descripcion.trim();
      if (comercio && !data.idCategoriaGasto) {
        setBuscandoUltimo(true);
        try {
          const ultimo = await ultimoGastoPorDescripcionAction({
            descripcion: comercio,
            idCuenta: data.cuentaOrigen || undefined,
            // El ticket suele venir en mayúsculas: se compara igual, pero exacto.
            sinMayusculas: true,
          });
          if (
            ultimo?.categoriaId &&
            options.categoriasGasto.some((c) => c.id === ultimo.categoriaId)
          ) {
            patch.idCategoriaGasto = ultimo.categoriaId;
            completados.push("Categoría");
          }
          // El monto del historial sólo si el ticket no lo trajo ni lo cargó el usuario.
          if (
            patch.montoOrigen === undefined &&
            data.montoOrigen === 0 &&
            ultimo &&
            ultimo.monto > 0
          ) {
            patch.montoOrigen = ultimo.monto;
            completados.push("Monto");
          }
        } catch {
          // Si la consulta falla, se aplica igual lo que trajo el ticket.
        } finally {
          setBuscandoUltimo(false);
        }
      }

      if (Object.keys(patch).length > 0) handleSetData(patch);

      if (completados.length === 0 && respetados.length === 0) {
        toast.info("No pude leer datos del ticket. Cargalos a mano.");
        return;
      }
      if (completados.length === 0) {
        toast.info(`Ya tenías cargado: ${respetados.join(", ")}.`);
        return;
      }
      toast.success(
        `Se completó: ${completados.join(", ")}.` +
          (respetados.length > 0
            ? ` No se tocó ${respetados.join(", ")} (ya lo tenías).`
            : "") +
          " Revisá antes de guardar."
      );
    },
    [data, handleSetData, options.categoriasGasto]
  );

  const isValid =
    data.descripcion.trim().length > 0 &&
    data.cuentaOrigen > 0 &&
    data.montoOrigen > 0 &&
    data.idCategoriaGasto > 0;

  /**
   * **Dictado por voz (G3)**: la pantalla se declara dictable ante el FAB 🎤.
   *
   * - `config` = los campos + las **opciones reales** de esta pantalla, con el
   *   vocabulario ya fusionado (`useAliasDeCampo`: sistema + lo aprendido).
   * - `aplicar` = escribe lo que se entendió y devuelve el **"antes"** (para
   *   deshacer). Reusa la regla que ya existía: si la frase dejó la **Descripción**
   *   pero no la Categoría o el Monto, se completan con el **último gasto con esa
   *   misma descripción** (lo que la frase dijo **no** se pisa).
   * - `escribir` = valores sueltos (✕ de un chip, elegir un candidato, deshacer).
   *
   * ⚠️ La voz **nunca guarda**: solo escribe los campos.
   */
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const opcionesCuenta = useMemo(
    () => options.cuentas.map((c) => ({ value: String(c.id), label: c.nombre })),
    [options.cuentas]
  );
  const opcionesCategoria = useMemo(
    () =>
      options.categoriasGasto.map((c) => ({
        value: String(c.id),
        label: c.nombre,
      })),
    [options.categoriasGasto]
  );
  const aliasCuenta = useAliasDeCampo("cuenta", opcionesCuenta);
  const aliasCategoria = useAliasDeCampo("categoriaGasto", opcionesCategoria);

  const config = useMemo(() => {
    const base = crearDictadoGasto(options);
    return {
      ...base,
      campos: base.campos.map((campo) =>
        campo.campo === "cuentaOrigen"
          ? { ...campo, alias: aliasCuenta }
          : campo.campo === "idCategoriaGasto"
            ? { ...campo, alias: aliasCategoria }
            : campo
      ),
    };
  }, [options, aliasCuenta, aliasCategoria]);

  const pantalla = useMemo<PantallaDictable>(
    () => ({
      config,
      aplicar: async (resultado) => {
        const actuales = dataRef.current as unknown as Record<string, unknown>;
        const campoDe = (nombre: string) =>
          config.campos.find((c) => c.campo === nombre);
        const tieneValor = (campo: CampoDictable) => tieneValorEn(campo, actuales);
        const tieneValorDe = (nombre: string) => {
          const campo = campoDe(nombre);
          return campo ? tieneValor(campo) : false;
        };

        /**
         * Regla **7** del plan de voz (§15.4): **lo explícito pisa, lo implícito
         * sólo completa campos vacíos**. El parser marca cada asignación como
         * explícita (salió de la zona de un campo nombrado) o implícita; acá se
         * descartan las implícitas cuyo campo **ya tiene valor** (lo que el
         * usuario cargó a mano se respeta) y se avisa en la burbuja.
         */
        const omitidos: string[] = [];
        const vigentes = resultado.asignaciones.filter((a) => {
          if (a.explicito) return true;
          const campo = campoDe(a.campo);
          if (!campo || !tieneValor(campo)) return true;
          omitidos.push(campo.etiqueta ?? campo.campo);
          return false;
        });

        const valores: Record<string, string | number> = {};
        for (const a of vigentes) valores[a.campo] = a.valor;

        const descripcion =
          typeof valores.descripcion === "string" ? valores.descripcion.trim() : "";
        // El **historial** también es implícito ⇒ sólo completa campos que estén
        // vacíos (si el usuario ya eligió categoría o monto, se respetan).
        const faltaCategoria =
          valores.idCategoriaGasto === undefined &&
          !tieneValorDe("idCategoriaGasto");
        const faltaMonto =
          valores.montoOrigen === undefined && !tieneValorDe("montoOrigen");

        if (descripcion && (faltaCategoria || faltaMonto)) {
          setBuscandoUltimo(true);
          try {
            const ultimo = await ultimoGastoPorDescripcionAction({
              descripcion,
              idCuenta:
                Number(valores.cuentaOrigen) ||
                dataRef.current.cuentaOrigen ||
                undefined,
              // El dictado llega en minúsculas: se compara igual, pero exacto.
              sinMayusculas: true,
            });
            if (ultimo) {
              if (
                faltaCategoria &&
                ultimo.categoriaId &&
                options.categoriasGasto.some((c) => c.id === ultimo.categoriaId)
              ) {
                valores.idCategoriaGasto = ultimo.categoriaId;
                vigentes.push({
                  campo: "idCategoriaGasto",
                  valor: ultimo.categoriaId,
                  texto: descripcion,
                  origen: "historial",
                  puntaje: 1,
                });
              }
              if (faltaMonto && ultimo.monto > 0) {
                valores.montoOrigen = ultimo.monto;
                vigentes.push({
                  campo: "montoOrigen",
                  valor: ultimo.monto,
                  texto: descripcion,
                  origen: "historial",
                  puntaje: 1,
                });
              }
            }
          } catch {
            // Si la consulta falla, se aplica igual lo que se entendió de la frase.
          } finally {
            setBuscandoUltimo(false);
          }
        }

        // Snapshot del "antes" **de los campos que se van a tocar**.
        const antes: ValoresPantalla = {};
        for (const campo of Object.keys(valores)) {
          antes[campo] = (
            dataRef.current as unknown as Record<string, string | number | undefined>
          )[campo];
        }
        handleSetData(valores as unknown as Partial<MovimientoData>);

        // El FAB arma los chips y el aviso con el resultado **filtrado**.
        resultado.asignaciones = vigentes;
        resultado.valores = valores;
        resultado.omitidos = omitidos;
        return antes;
      },
      /**
       * Escribe valores sueltos (✕ de un chip, elegir un candidato, deshacer) y
       * devuelve el **"antes"** de esos campos: así el chip que agrega el FAB al
       * elegir un candidato también sabe a qué valor volver.
       */
      escribir: (valores) => {
        const antes: ValoresPantalla = {};
        for (const campo of Object.keys(valores)) {
          antes[campo] = (
            dataRef.current as unknown as Record<string, string | number | undefined>
          )[campo];
        }
        handleSetData(valores as unknown as Partial<MovimientoData>);
        return antes;
      },
    }),
    [config, handleSetData, options]
  );

  useRegistrarPantallaDictable(pantalla);

  // ℹ️ La **vía B** (aprender la corrección) se mudó al paso de confirmación
  // (2026-09-24): se aprende **al guardar con éxito**, no al tocar Siguiente.

  // ── Layout "fintech" (diseño D, 2026-10-01) ────────────────────────────────
  // Moneda de la cuenta elegida: da el símbolo del héroe (monto).
  const isoCuenta =
    options.cuentas.find((c) => c.id === data.cuentaOrigen)?.moneda?.codigoISO ??
    "";

  return (
    <StepShellFintech
      titulo="Gasto"
      step={2}
      total={3}
      accion={
        // Escáner del ticket (plan OCR §11): sólo icono, al ras del título.
        // Completa Descripción (comercio), Fecha y Monto, y la Categoría por historial.
        <button
          type="button"
          onClick={() => setEscanerAbierto(true)}
          aria-label="Escanear el ticket"
          title="Escanear el ticket"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-muted text-subtitle transition-colors hover:text-header disabled:opacity-50"
        >
          <Camera className="h-5 w-5" />
        </button>
      }
      heroe={
        <HeroeFintech etiqueta={`Monto${isoCuenta ? ` · ${isoCuenta}` : ""}`}>
          <NumberField
            hero
            heroPrefix={isoCuenta ? simboloMoneda(isoCuenta) : ""}
            label="Monto"
            value={data.montoOrigen}
            onChange={(v) => handleSetData({ montoOrigen: v })}
          />
        </HeroeFintech>
      }
      footer={
        <BotonPrincipal
          onClick={() => navigateTo(STEP_CONFIRMACION)}
          disabled={!isValid}
        >
          Siguiente
        </BotonPrincipal>
      }
    >
      {/* Campos secundarios, agrupados en una sola tarjeta. */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <AutoCompleteField
          label="Descripción"
          value={data.descripcion}
          onChange={(v) => handleSetData({ descripcion: v })}
          buscar={buscarDescripcionesGastoAction}
          onSelect={handleDescripcionElegida}
          placeholder="Ej: Supermercado"
        />

        <DateField
          label="Fecha"
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

        <SelectField
          label="Categoría de gasto"
          value={data.idCategoriaGasto ? String(data.idCategoriaGasto) : ""}
          onChange={(v) => handleSetData({ idCategoriaGasto: Number(v) })}
          options={options.categoriasGasto.map((c) => ({
            value: String(c.id),
            label: c.nombre,
          }))}
          onCreate={setNuevaCategoria}
          createLabel="Nueva categoría"
        />
      </div>

      {/* Alta rápida de la categoría sin salir del wizard. Los movimientos
          guardan la categoría por ID, así que se agrega a las opciones del
          stepper (contexto) y luego se selecciona por id. */}
      {nuevaCategoria !== null && (
        <QuickCreateModal
          open
          title="Nueva categoría de gasto"
          placeholder="Ej. Supermercado"
          initialName={nuevaCategoria}
          existing={options.categoriasGasto.map((c) => ({
            value: String(c.id),
            label: c.nombre,
          }))}
          create={async (nombre) => {
            const creada = await crearCategoriaGasto({ nombre });
            if (!creada) throw new Error("No se pudo crear la categoría");
            addCategoriaGasto({ id: creada.id, nombre: creada.nombre });
            return { value: String(creada.id), label: creada.nombre };
          }}
          onCreated={(option) => {
            handleSetData({ idCategoriaGasto: Number(option.value) });
            setNuevaCategoria(null);
          }}
          onClose={() => setNuevaCategoria(null)}
        />
      )}

      {/* Espera que BLOQUEA la pantalla mientras se recupera el último gasto. */}
      <LoadingOverlay
        show={buscandoUltimo}
        message="Buscando el último gasto..."
      />

      {escanerAbierto && (
        <CamaraEscaner
          documento="el ticket"
          extraer={extraerConTexto}
          onListo={aplicarTicket}
          onCerrar={() => setEscanerAbierto(false)}
        />
      )}

      {/* ⚠️ TEMPORAL: diagnóstico del OCR (ver y copiar el texto crudo leído). */}
      {textoLeido !== null && (
        <button
          type="button"
          onClick={() => setVerTexto(true)}
          className="w-full rounded-xl border border-dashed border-border px-4 py-2 text-xs text-subtitle"
        >
          Ver el texto que leyó la cámara
        </button>
      )}

      <Modal
        open={verTexto}
        onClose={() => setVerTexto(false)}
        title="Texto que leyó la cámara"
        footer={
          <BotonPrincipal onClick={() => void copiarTexto()}>
            Copiar el texto
          </BotonPrincipal>
        }
      >
        <textarea
          readOnly
          value={textoLeido ?? ""}
          rows={14}
          className="w-full resize-none rounded-lg border border-border bg-background p-2 font-mono text-[11px] leading-tight text-header"
        />
      </Modal>
    </StepShellFintech>
  );
}
