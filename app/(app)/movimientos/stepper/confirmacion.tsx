"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, ArrowLeft } from "lucide-react";
import { useMovimientoStepper } from "./stepper-context";
import {
  Fila,
  formatFecha,
  StepShellFintech,
  HeroeFintech,
  HeroeValor,
  BotonPrincipal,
  BotonSecundario,
} from "./ui";
import { CONCEPTO_STEP, type MovimientoConcepto } from "./types";
import { numberToCurrency, timeToDecimal } from "@/lib/utils";
import { calcularMontoJornada } from "@/backend/src/lib/jornadas";
import { fraseContraparte } from "@/lib/prestamos";
import {
  cobrarTrabajo,
  pagarPrestamo,
  ajustarCuenta,
  pagarGasto,
  gastoDirecto,
  transferir,
  cargarJornadaTrabajo,
  cargarTareaTrabajo,
} from "@/backend/src/actions/movimientos";
import {
  itemsDelTrabajo,
  modalidadDeclarada,
  seleccionDeItems,
} from "./cobro-items";
import { useUltimoDictado } from "@/components/voz/dictado-pantalla";
import { useVoz } from "@/components/voz/voz-provider";
import { correccionesDeDictado } from "@/lib/voz/vocabulario";
import { invalidarHistoriales } from "@/lib/historial-cuentas";

export function Confirmacion() {
  const { data, navigateTo, resetData, options, direct, volverA } =
    useMovimientoStepper();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  // Dictado aplicado (si el usuario llenó esta pantalla por voz): al guardar se
  // le suman `usos` a los alias propios que resolvieron valores.
  const { ultimo, setUltimo } = useUltimoDictado();
  const voz = useVoz();

  const concepto = data.concepto as MovimientoConcepto | "";
  const cuentaNombre = (id: number) =>
    options.cuentas.find((c) => c.id === id)?.nombre ?? "—";
  // ISO de la moneda de una cuenta (formatea los montos con el símbolo correcto
  // según la moneda de la cuenta en la confirmación).
  const cuentaISO = (id: number) =>
    options.cuentas.find((c) => c.id === id)?.moneda?.codigoISO ?? "ARS";

  const prestamo = options.prestamos.find((p) => p.id === data.idPrestamo);
  const gasto = options.gastos.find((g) => g.id === data.idGasto);
  const categoria = options.categoriasGasto.find(
    (c) => c.id === data.idCategoriaGasto
  );

  const filas: { label: string; value: string }[] = [];

  if (concepto === "CobrarTrabajo") {
    const trabajoC = options.trabajos.find((t) => t.id === data.idTrabajo);
    const modalidad = trabajoC?.modalidadCobro ?? "horas_variables";
    const esHorasFijas = modalidad === "horas_fijas";
    const declarada = modalidadDeclarada(modalidad);
    const items = itemsDelTrabajo(options.itemsPendientes, data.idTrabajo);
    const seleccion = seleccionDeItems(items, [
      ...data.idsJornadas,
      ...data.idsTareas,
    ]);
    // Mismo cálculo que el paso y que el backend: Σ ítems · horas × precio · monto en `fijo`.
    const calculado = declarada
      ? esHorasFijas
        ? Number((data.horasPeriodo * (trabajoC?.precioHora ?? 0)).toFixed(2))
        : data.montoOrigen
      : seleccion.monto;

    filas.push(
      { label: "Fecha", value: formatFecha(data.fecha) },
      { label: "Trabajo", value: trabajoC?.nombre ?? "—" },
      {
        label: "Período",
        value:
          data.fechaDesde && data.fechaHasta
            ? `${formatFecha(data.fechaDesde)} al ${formatFecha(data.fechaHasta)}`
            : "—",
      }
    );
    if (esHorasFijas) {
      filas.push({
        label: "Horas",
        value: `${data.horasPeriodo} h × ${numberToCurrency(trabajoC?.precioHora ?? 0)}`,
      });
    } else if (!declarada) {
      filas.push({
        label: "Ítems",
        value: `${seleccion.idsJornadas.length} jornada(s) · ${seleccion.idsTareas.length} tarea(s)`,
      });
    }
    // El calculado se muestra sólo si difiere: en `fijo` son el mismo número y en
    // los demás casos igualarlo significa que no hubo ajuste (P2: la diferencia es
    // un snapshot, no se sigue ni ajusta el ingreso).
    if (calculado !== data.montoOrigen) {
      filas.push({
        label: "Calculado",
        value: numberToCurrency(calculado, cuentaISO(data.cuentaOrigen)),
      });
    }
    filas.push(
      { label: "Cuenta", value: cuentaNombre(data.cuentaOrigen) },
      {
        label: "Cobrado",
        value: numberToCurrency(data.montoOrigen, cuentaISO(data.cuentaOrigen)),
      }
    );
  } else if (concepto === "PagoPrestamo") {
    filas.push(
      { label: "Fecha", value: formatFecha(data.fecha) },
      { label: "Cuenta", value: cuentaNombre(data.cuentaOrigen) },
      {
        label: "Monto a pagar",
        value: numberToCurrency(data.montoOrigen, cuentaISO(data.cuentaOrigen)),
      },
      {
        label: "Préstamo",
        value: prestamo
          ? `${prestamo.detalle ?? "Préstamo"} — ${prestamo.personaContraparte?.nombre ?? "—"} (${fraseContraparte(prestamo.sentido)}) · Saldo ${numberToCurrency(
              prestamo.saldo,
              prestamo.monedaISO ?? cuentaISO(data.cuentaOrigen)
            )}`
          : "—",
      }
    );
  } else if (concepto === "AjusteCuenta") {
    filas.push(
      { label: "Fecha", value: formatFecha(data.fecha) },
      { label: "Cuenta", value: cuentaNombre(data.cuentaOrigen) },
      {
        label: "Monto",
        value: `${data.montoOrigen > 0 ? "+" : ""}${numberToCurrency(
          data.montoOrigen,
          cuentaISO(data.cuentaOrigen)
        )}`,
      }
    );
  } else if (concepto === "PagoGasto") {
    filas.push(
      { label: "Fecha", value: formatFecha(data.fecha) },
      { label: "Cuenta", value: cuentaNombre(data.cuentaOrigen) },
      {
        label: "Monto a pagar",
        value: numberToCurrency(data.montoOrigen, cuentaISO(data.cuentaOrigen)),
      },
      {
        label: "Gasto",
        value: gasto
          ? `${gasto.descripcion ?? "Gasto"} — Saldo ${numberToCurrency(
              gasto.saldo,
              cuentaISO(data.cuentaOrigen)
            )} · Vence ${formatFecha(gasto.fechaVencimiento)}`
          : "—",
      }
    );
  } else if (concepto === "GastoDirecto") {
    filas.push(
      { label: "Descripción", value: data.descripcion || "—" },
      { label: "Fecha", value: formatFecha(data.fecha) },
      { label: "Cuenta", value: cuentaNombre(data.cuentaOrigen) },
      {
        label: "Monto",
        value: numberToCurrency(data.montoOrigen, cuentaISO(data.cuentaOrigen)),
      },
      { label: "Categoría", value: categoria?.nombre ?? "—" }
    );
  } else if (concepto === "Transferencia") {
    filas.push(
      { label: "Fecha", value: formatFecha(data.fecha) },
      { label: "Motivo", value: data.motivo },
      { label: "Cuenta origen", value: cuentaNombre(data.cuentaOrigen) },
      {
        label: "Monto origen",
        value: numberToCurrency(data.montoOrigen, cuentaISO(data.cuentaOrigen)),
      },
      { label: "Cuenta destino", value: cuentaNombre(data.cuentaDestino) },
      {
        label: "Monto destino",
        value: numberToCurrency(data.montoDestino, cuentaISO(data.cuentaDestino)),
      }
    );
  } else if (concepto === "JornadaTrabajo") {
    const trabajoJ = options.trabajos.find((t) => t.id === data.idTrabajo);
    filas.push(
      { label: "Fecha", value: formatFecha(data.fecha) },
      { label: "Trabajo", value: trabajoJ?.nombre ?? "—" },
      { label: "Hora desde", value: data.horaDesde || "—" },
      { label: "Hora hasta", value: data.horaHasta || "—" }
    );
    if (data.montoPropina > 0) {
      filas.push(
        {
          label: "Propina",
          value: numberToCurrency(data.montoPropina, cuentaISO(data.cuentaPropina)),
        },
        { label: "Cuenta (propina)", value: cuentaNombre(data.cuentaPropina) }
      );
    }
  } else if (concepto === "CargarTarea") {
    const trabajoT = options.trabajos.find((t) => t.id === data.idTrabajo);
    filas.push(
      {
        label: "Fecha/hora",
        value: `${formatFecha(data.fecha)} ${data.horaDesde || "—"}`,
      },
      { label: "Trabajo", value: trabajoT?.nombre ?? "—" },
      { label: "Descripción", value: data.descripcionTarea || "—" }
    );
    if (data.horasTarea > 0) {
      filas.push({ label: "Horas", value: String(data.horasTarea) });
    }
    filas.push({ label: "Monto ganado", value: numberToCurrency(data.montoTarea) });
  }

  const guardar = async () => {
    if (!concepto) return;
    setSubmitting(true);
    try {
      switch (concepto) {
        case "CobrarTrabajo":
          await cobrarTrabajo({
            fecha: data.fecha,
            idTrabajo: data.idTrabajo,
            idCuenta: data.cuentaOrigen,
            // El monto es el COBRADO (editable); el calculado lo arma el backend.
            monto: data.montoOrigen,
            // El rango declarado sólo viaja en `fijo`/`horas_fijas`: en las
            // variables el backend lo deriva de los ítems tildados.
            fechaDesde: data.fechaDesde || undefined,
            fechaHasta: data.fechaHasta || undefined,
            horasPeriodo: data.horasPeriodo > 0 ? data.horasPeriodo : undefined,
            idsJornadas: data.idsJornadas,
            idsTareas: data.idsTareas,
          });
          break;
        case "PagoPrestamo":
          await pagarPrestamo({
            fecha: data.fecha,
            monto: data.montoOrigen,
            idCuenta: data.cuentaOrigen,
            idPrestamo: data.idPrestamo,
          });
          break;
        case "AjusteCuenta":
          await ajustarCuenta({
            fecha: data.fecha,
            monto: data.montoOrigen,
            idCuenta: data.cuentaOrigen,
          });
          break;
        case "PagoGasto":
          await pagarGasto({
            fecha: data.fecha,
            monto: data.montoOrigen,
            idCuenta: data.cuentaOrigen,
            idGasto: data.idGasto,
          });
          break;
        case "GastoDirecto":
          await gastoDirecto({
            descripcion: data.descripcion,
            fecha: data.fecha,
            monto: data.montoOrigen,
            idCuenta: data.cuentaOrigen,
            idCategoriaGasto: data.idCategoriaGasto,
          });
          break;
        case "Transferencia":
          await transferir({
            fecha: data.fecha,
            motivo: data.motivo,
            montoOrigen: data.montoOrigen,
            idCuentaOrigen: data.cuentaOrigen,
            montoDestino: data.montoDestino,
            idCuentaDestino: data.cuentaDestino,
          });
          break;
        case "JornadaTrabajo":
          await cargarJornadaTrabajo({
            fecha: data.fecha,
            horaDesde: timeToDecimal(data.horaDesde),
            horaHasta: timeToDecimal(data.horaHasta),
            montoPropina: data.montoPropina,
            idCuenta: data.montoPropina > 0 ? data.cuentaPropina : undefined,
            // Único vínculo: la jornada nace **pendiente de liquidar**.
            idTrabajo: data.idTrabajo,
          });
          break;
        case "CargarTarea": {
          const fechaHoraTarea = new Date(
            `${data.fecha}T${data.horaDesde || "00:00"}`
          ).toISOString();
          await cargarTareaTrabajo({
            fechaHoraTarea,
            // Fecha CALENDARIO LOCAL (la que eligió el usuario en el wizard).
            fechaTarea: data.fecha,
            descripcion: (data.descripcionTarea ?? "").trim() || undefined,
            horasTarea: data.horasTarea > 0 ? data.horasTarea : undefined,
            montoTarea: data.montoTarea,
            // Único vínculo: la tarea nace **pendiente de liquidar**.
            idTrabajo: data.idTrabajo,
          });
          break;
        }
      }
      toast.success("Movimiento guardado correctamente");
      // El movimiento pudo cambiar los saldos/movimientos de una o dos cuentas:
      // se descarta su 1ª página cacheada (la del carrusel de Inicio) para que se
      // vuelva a pedir. Sin esto, al volver a Inicio la caché quedaría vieja.
      invalidarHistoriales(
        [data.cuentaOrigen, data.cuentaDestino, data.cuentaPropina].filter(
          (id): id is number => typeof id === "number" && id > 0
        )
      );
      // **Vía B** (aprender la corrección) — movida acá el 2026-09-24: se aprende
      // **al guardar con éxito**, no al tocar Siguiente. Si el guardado falla, no
      // se aprende nada. Compara lo que la voz había llenado contra lo que quedó
      // en el formulario (`correccionesDeDictado` ya ignora vacíos e iguales).
      if (ultimo) {
        for (const c of correccionesDeDictado(
          ultimo.resultado,
          data as unknown as Record<string, unknown>,
          (campo) => ultimo.campos.find((c) => c.campo === campo)
        )) {
          void voz?.aprender({ ...c, origen: "correccion" });
        }
      }
      // `usos` del vocabulario: se suma **acá** (al guardar) y no en el camino
      // del dictado. No se espera: es un contador de diagnóstico y no debe
      // demorar la salida del wizard. El dictado se consume (si no, quedaría la
      // burbuja con chips viejos al volver al paso 1).
      if (ultimo?.usos.length) void voz?.registrarUsos(ultimo.usos);
      setUltimo(null);
      // En modo directo (sin stepper) se vuelve al origen que lanzó el wizard
      // (volverA, ej. la pantalla del período) o al dashboard por defecto.
      if (direct) {
        router.push(volverA ?? "/dashboard");
        return;
      }
      resetData();
      navigateTo(0);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar el movimiento"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Acción del pie compartida por el layout nuevo y el de siempre.
  const irAtras = () => navigateTo(concepto ? CONCEPTO_STEP[concepto] : 0);

  // ── Confirmación "fintech" (diseño D, §210) ─────────────────────────────
  // TODOS los flujos: héroe con el número protagonista + resumen en filas +
  // acciones apiladas (Guardar full-width + Atrás). El `‹` de la cabecera sigue
  // siendo el "Cancelar" del wizard.
  //
  // El héroe es el MISMO dato que la fila equivalente del resumen (por eso esa
  // fila se omite abajo para no repetirla): el monto cobrado en el cobro, el
  // monto a pagar en los pagos, lo ganado en la tarea y el **estimado** en la
  // jornada (que el backend calcula con el mismo helper).
  const heroe = ((): { etiqueta: string; iso: string; valor: string } => {
    const iso = cuentaISO(data.cuentaOrigen);
    switch (concepto) {
      case "Transferencia":
        return {
          etiqueta: "Monto origen",
          iso,
          valor: numberToCurrency(data.montoOrigen, iso),
        };
      case "AjusteCuenta":
        // El ajuste distingue el sentido con el signo (igual que en la fila).
        return {
          etiqueta: "Monto",
          iso,
          valor: `${data.montoOrigen > 0 ? "+" : ""}${numberToCurrency(
            data.montoOrigen,
            iso
          )}`,
        };
      case "PagoGasto":
      case "PagoPrestamo":
        return {
          etiqueta: "Monto a pagar",
          iso,
          valor: numberToCurrency(data.montoOrigen, iso),
        };
      case "CobrarTrabajo":
        return {
          etiqueta: "Cobrado",
          iso,
          valor: numberToCurrency(data.montoOrigen, iso),
        };
      case "CargarTarea":
        return {
          etiqueta: "Monto ganado",
          iso: options.monedaISO,
          valor: numberToCurrency(data.montoTarea, options.monedaISO),
        };
      case "JornadaTrabajo": {
        // El monto de la jornada NO se carga en el wizard: se muestra el mismo
        // estimado que el paso 2 para que el usuario sepa qué va a sumar.
        const trabajoJ = options.trabajos.find((t) => t.id === data.idTrabajo);
        const estimado =
          trabajoJ && data.horaDesde && data.horaHasta
            ? calcularMontoJornada(
                timeToDecimal(data.horaDesde),
                timeToDecimal(data.horaHasta),
                trabajoJ.precioHora
              )
            : 0;
        return {
          etiqueta: "Monto estimado",
          iso: options.monedaISO,
          valor:
            estimado > 0 ? numberToCurrency(estimado, options.monedaISO) : "—",
        };
      }
      default:
        return {
          etiqueta: "Monto",
          iso,
          valor: numberToCurrency(data.montoOrigen, iso),
        };
    }
  })();
  const filasResumen = filas.filter((f) => f.label !== heroe.etiqueta);

  return (
    <StepShellFintech
      titulo="Confirmar"
      step={3}
      total={3}
      cancelDisabled={submitting}
      heroe={
        <HeroeFintech etiqueta={`${heroe.etiqueta} · ${heroe.iso}`}>
          <HeroeValor>{heroe.valor}</HeroeValor>
        </HeroeFintech>
      }
      footer={
        <>
          <BotonPrincipal onClick={guardar} disabled={submitting}>
            <Save className="h-4 w-4" />
            {submitting ? "Guardando..." : "Guardar"}
          </BotonPrincipal>
          <BotonSecundario onClick={irAtras} disabled={submitting}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Atrás
          </BotonSecundario>
        </>
      }
    >
      {filasResumen.length > 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 py-1">
          {filasResumen.map((f) => (
            <Fila key={f.label} label={f.label} value={f.value} />
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-subtitle">
          No hay datos para confirmar.
        </p>
      )}
    </StepShellFintech>
  );
}
