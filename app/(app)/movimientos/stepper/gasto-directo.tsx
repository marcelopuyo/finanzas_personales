"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useMovimientoStepper } from "./stepper-context";
import {
  StepShell,
  NavButtons,
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
import { useAliasDeCampo, useVoz } from "@/components/voz/voz-provider";
import { correccionesDeDictado } from "@/lib/voz/vocabulario";
import {
  useRegistrarPantallaDictable,
  useUltimoDictado,
  type PantallaDictable,
  type ValoresPantalla,
} from "@/components/voz/dictado-pantalla";

export function GastoDirecto() {
  const { data, handleSetData, navigateTo, options, addCategoriaGasto } =
    useMovimientoStepper();
  // Alta rápida (opción A): texto buscado con el que abre el modal de categoría
  // nueva (null = cerrado).
  const [nuevaCategoria, setNuevaCategoria] = useState<string | null>(null);
  // Overlay que BLOQUEA la pantalla mientras se trae el último gasto.
  const [buscandoUltimo, setBuscandoUltimo] = useState(false);

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
      if (ultimo.monto > 0) patch.montoOrigen = ultimo.monto;
      // Solo si esa categoría sigue existiendo (podría estar eliminada).
      if (
        ultimo.categoriaId &&
        options.categoriasGasto.some((c) => c.id === ultimo.categoriaId)
      ) {
        patch.idCategoriaGasto = ultimo.categoriaId;
      }
      if (Object.keys(patch).length === 0) {
        toast.info("Ese gasto no tiene categoría ni monto para copiar");
        return;
      }
      handleSetData(patch);
      toast.success(`Se completó con el último gasto "${descripcion}"`);
    } catch {
      toast.error("No se pudo recuperar el último gasto");
    } finally {
      setBuscandoUltimo(false);
    }
  };

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
        const valores = { ...resultado.valores };
        const asignaciones = [...resultado.asignaciones];
        const descripcion =
          typeof valores.descripcion === "string" ? valores.descripcion.trim() : "";
        const faltaCategoria = valores.idCategoriaGasto === undefined;
        const faltaMonto = valores.montoOrigen === undefined;

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
                asignaciones.push({
                  campo: "idCategoriaGasto",
                  valor: ultimo.categoriaId,
                  texto: descripcion,
                  origen: "historial",
                  puntaje: 1,
                });
              }
              if (faltaMonto && ultimo.monto > 0) {
                valores.montoOrigen = ultimo.monto;
                asignaciones.push({
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
        return antes;
      },
      escribir: (valores) =>
        handleSetData(valores as unknown as Partial<MovimientoData>),
    }),
    [config, handleSetData, options]
  );

  useRegistrarPantallaDictable(pantalla);

  /**
   * **Vía B — corrección silenciosa** (plan de G2, §7): al confirmar el paso se
   * compara lo que la voz había llenado con lo que quedó en el formulario.
   *
   * Si el usuario **cambió** un campo de catálogo por una opción real, se aprende
   * ("cuando digo «X», es esta categoría") con `origen: 'correccion'`. Si lo dejó
   * **vacío** o **igual**, no se aprende nada.
   *
   * ⚠️ La voz **nunca guarda**: esto solo aprende; el gasto se crea en el paso de
   * confirmación, como siempre.
   */
  const { ultimo } = useUltimoDictado();
  const voz = useVoz();
  const aprenderCorrecciones = () => {
    if (!ultimo) return;
    const correcciones = correccionesDeDictado(
      ultimo.resultado,
      dataRef.current as unknown as Record<string, unknown>,
      (campo) => config.campos.find((c) => c.campo === campo)
    );
    for (const c of correcciones) {
      void voz?.aprender({ ...c, origen: "correccion" });
    }
  };

  return (
    <StepShell
      title="Por favor ingrese la información del gasto directo:"
      step={2}
      total={3}
      footer={
        <NavButtons
          onBack={() => navigateTo(0)}
          onNext={() => {
            // Antes de pasar al resumen: ¿corrigió algo que la voz había llenado?
            aprenderCorrecciones();
            navigateTo(STEP_CONFIRMACION);
          }}
          nextDisabled={!isValid}
        />
      }
    >
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

      <NumberField
        label="Monto"
        value={data.montoOrigen}
        onChange={(v) => handleSetData({ montoOrigen: v })}
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
    </StepShell>
  );
}
