"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import type { ResultadoDictado } from "@/lib/voz/tipos";
import { DictadoCampos } from "@/components/voz/dictado-campos";
import { crearDictadoGasto } from "./dictado-gasto";

export function GastoDirecto() {
  const { data, handleSetData, navigateTo, options, addCategoriaGasto } =
    useMovimientoStepper();
  // Alta rápida (opción A): texto buscado con el que abre el modal de categoría
  // nueva (null = cerrado).
  const [nuevaCategoria, setNuevaCategoria] = useState<string | null>(null);
  // Overlay que BLOQUEA la pantalla mientras se trae el último gasto.
  const [buscandoUltimo, setBuscandoUltimo] = useState(false);

  /**
   * Dictado: se recuerda **qué** se aplicó (para los chips) y **qué había
   * antes** (para deshacer, 1 nivel). Las dos entradas —el panel de la pantalla
   * y el texto que llega por URL (`?dicho=`) desde `/voz`— terminan llamando a
   * `aplicarDictado`, así que los chips y el deshacer funcionan igual.
   */
  /**
   * Dictado: se recuerda **qué** se aplicó (para los chips) y **qué había**
   * antes (para deshacer, 1 nivel).
   *
   * Además, si la frase dejó la **Descripción** pero no la Categoría (o el
   * Monto), se completan con el **último gasto que tenga esa misma descripción**
   * —igual que hace el autocompletado al elegir una sugerencia—.
   *
   * ⚠️ **Lo que la frase dijo manda**: solo se completa lo que quedó vacío, así
   * que si el usuario nombró una categoría, esa se respeta.
   */
  const [dictadoAplicado, setDictadoAplicado] = useState<ResultadoDictado | null>(null);
  const antesDelDictado = useRef<Partial<MovimientoData> | null>(null);

  const aplicarDictado = async (resultado: ResultadoDictado) => {
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
          idCuenta: Number(valores.cuentaOrigen) || data.cuentaOrigen || undefined,
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

    const antes: Record<string, unknown> = {};
    for (const campo of Object.keys(valores)) {
      antes[campo] = (data as unknown as Record<string, unknown>)[campo];
    }
    antesDelDictado.current = antes as Partial<MovimientoData>;
    // `valores` ya trae los nombres de campo de `MovimientoData`
    // (idCategoriaGasto/cuentaOrigen numéricos, fecha yyyy-mm-dd).
    handleSetData(valores as unknown as Partial<MovimientoData>);
    setDictadoAplicado({ ...resultado, valores, asignaciones });
  };

  const deshacerDictado = () => {
    if (antesDelDictado.current) handleSetData(antesDelDictado.current);
    antesDelDictado.current = null;
    setDictadoAplicado(null);
  };

  /**
   * Texto que llega **por URL** (`?dicho=`), de la entrada `/voz` (Atajo de
   * Apple). No se aplica solo: **precarga el campo de dictado** para que el
   * usuario vea qué se dictó y confirme con «Interpretar».
   */
  const searchParams = useSearchParams();
  const dicho = searchParams.get("dicho") ?? "";

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

  return (
    <StepShell
      title="Por favor ingrese la información del gasto directo:"
      step={2}
      total={3}
      footer={
        <NavButtons
          onBack={() => navigateTo(0)}
          onNext={() => navigateTo(STEP_CONFIRMACION)}
          nextDisabled={!isValid}
        />
      }
    >
      <DictadoCampos
        config={crearDictadoGasto(options)}
        textoInicial={dicho}
        onInterpretar={aplicarDictado}
        aplicado={dictadoAplicado}
        onDeshacer={deshacerDictado}
      />

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
