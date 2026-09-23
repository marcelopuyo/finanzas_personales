"use client";

import { useState } from "react";
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
