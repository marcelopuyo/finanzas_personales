"use client";

// Wizard de ALTA de un trabajo (2026-09-05, §3.1 del plan).
// Ramas:
//   - Fijo por período     → datos → tipo de pago → confirmación (3 pasos)
//   - Por tarea            → datos → tipo de pago → confirmación (3 pasos)
//   - Por hora             → datos → tipo de pago → modalidad horas → precio → confirmación (5 pasos)
// Reutiliza las primitivas compartidas de `components/wizard/ui.tsx`
// (extraídas del wizard de movimientos, 2026-09-06).
//
// ⚠️ 2026-10-03: pasa al layout **"fintech"** (diseño D) — el `StepShellFintech`
// compartido: cabecera con el `‹` que cancela y sale, `N/total`, el héroe (el
// precio por hora cuando la rama es "por hora") y las acciones full-width. El
// nombre del paso, que antes iba en el indicador "Paso X de Y · …", es ahora el
// **título de la cabecera**.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { cn, dateTimeToString, numberToCurrency, simboloMoneda } from "@/lib/utils";
import { sufijoOrigen } from "@/lib/origen-crud";
import { crearTrabajo } from "@/backend/src/actions/trabajos";
import {
  BotonPrincipal,
  BotonSecundario,
  Campo,
  DateField,
  Fila,
  HeroeFintech,
  HeroeValor,
  NumberField,
  StepShellFintech,
  TextField,
  inputCls,
} from "@/components/wizard/ui";

type TipoPago = "" | "fijo" | "por_tarea" | "por_hora";
type ModalidadHoras = "" | "horas_variables" | "horas_fijas";

interface Estado {
  nombre: string;
  fechaInicio: string;
  memos: string;
  tipoPago: TipoPago;
  modalidadHoras: ModalidadHoras;
  precioHora: string;
}

function Tarjeta({
  activo,
  onClick,
  titulo,
  detalle,
}: {
  activo: boolean;
  onClick: () => void;
  titulo: string;
  detalle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors",
        activo
          ? "border-primary bg-primary/10"
          : "border-border bg-card hover:bg-muted"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border",
          activo ? "border-primary bg-primary text-primary-foreground" : "border-subtitle"
        )}
      >
        {activo && <Check className="h-3 w-3" />}
      </span>
      <span>
        <span className="block text-[14px] font-medium text-header">{titulo}</span>
        <span className="block text-[12px] text-subtitle">{detalle}</span>
      </span>
    </button>
  );
}

export function TrabajoWizard({
  origen,
  monedaISO,
}: {
  origen?: string;
  /** ISO 4217 de la **moneda predeterminada** del usuario: es la del precio por
   *  hora (símbolo del héroe y de la confirmación). */
  monedaISO: string;
}) {
  const router = useRouter();
  // Abierto desde el CRUD (que a su vez viene de una vista del dashboard): al
  // volver (paso 0) o tras guardar se regresa al listado conservando el origen
  // (mantiene la flecha "volver" a esa vista). Desde el CRUD normal vuelve al
  // listado tal como antes.
  const destino = `/cruds/trabajos${sufijoOrigen(origen)}`;
  const [estado, setEstado] = useState<Estado>({
    nombre: "",
    fechaInicio: "",
    memos: "",
    tipoPago: "",
    modalidadHoras: "",
    precioHora: "",
  });
  const [paso, setPaso] = useState(0);
  const [guardando, setGuardando] = useState(false);

  const ramaCorta = estado.tipoPago === "fijo" || estado.tipoPago === "por_tarea";
  // Secuencia de pasos según la rama.
  const totalPasos = () => (ramaCorta ? 3 : 5);
  const set = (patch: Partial<Estado>) => setEstado((e) => ({ ...e, ...patch }));

  const volver = () => {
    if (paso === 0) {
      router.push(destino);
      return;
    }
    setPaso((p) => p - 1);
  };

  const siguiente = () => {
    // Validaciones por paso
    if (paso === 0 && !estado.nombre.trim()) {
      toast.error("Indicá el nombre del trabajo");
      return;
    }
    if (paso === 0 && !estado.fechaInicio) {
      toast.error("Indicá la fecha de inicio");
      return;
    }
    if (paso === 1 && !estado.tipoPago) {
      toast.error("Elegí el tipo de pago");
      return;
    }
    if (paso === 2 && !ramaCorta && !estado.modalidadHoras) {
      toast.error("Elegí la modalidad de horas");
      return;
    }
    if (paso === 3 && !ramaCorta && (!estado.precioHora || Number(estado.precioHora) <= 0)) {
      toast.error("Indicá el precio por hora");
      return;
    }
    if (!ramaCorta && paso === 4) {
      // Paso de confirmación (5to) → guardar
      guardar();
      return;
    }
    if (ramaCorta && paso === 2) {
      guardar();
      return;
    }
    // En la rama corta, del paso 1 (tipo de pago) se pasa directo a confirmación (paso 2).
    setPaso((p) => p + 1);
  };

  const guardar = async () => {
    setGuardando(true);
    const porHora = estado.tipoPago === "por_hora";
    const modalidadCobro = (
      ramaCorta
        ? estado.tipoPago // 'fijo' | 'por_tarea'
        : estado.modalidadHoras // 'horas_variables' | 'horas_fijas'
    ) as "fijo" | "por_tarea" | "horas_variables" | "horas_fijas";
    try {
      await crearTrabajo({
        nombre: estado.nombre.trim(),
        fechaInicio: estado.fechaInicio,
        modalidadCobro,
        ...(porHora ? { precioHora: Number(estado.precioHora) } : {}),
        memos: estado.memos.trim() || undefined,
      });
      toast.success("Trabajo creado correctamente");
      router.push(destino);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el trabajo");
    } finally {
      setGuardando(false);
    }
  };

  // ── Layout "fintech" (diseño D, 2026-10-03) ───────────────────────────────
  // El **título de la cabecera** es el nombre del paso (antes iba en el
  // indicador "Paso X de Y · …", que el shell reemplaza por `N/total`).
  const esConfirmacion = ramaCorta ? paso === 2 : paso === 4;
  const rotuloPaso =
    paso === 0
      ? "Nuevo trabajo"
      : paso === 1
      ? "Tipo de pago"
      : esConfirmacion
      ? "Confirmar"
      : paso === 2
      ? "Modalidad de horas"
      : "Precio por hora";

  // El **precio por hora** (rama "por hora") es el único número del wizard: va
  // como héroe editable en su paso y **de sólo lectura** en la confirmación.
  const precioNum = Number(estado.precioHora) || 0;
  const heroe =
    paso === 3 ? (
      <HeroeFintech etiqueta={`Precio por hora · ${monedaISO}`}>
        <NumberField
          hero
          heroPrefix={simboloMoneda(monedaISO)}
          label="Precio por hora"
          value={precioNum}
          onChange={(v) => set({ precioHora: v === 0 ? "" : String(v) })}
        />
      </HeroeFintech>
    ) : esConfirmacion && !ramaCorta ? (
      <HeroeFintech etiqueta={`Precio por hora · ${monedaISO}`}>
        <HeroeValor>{numberToCurrency(precioNum, monedaISO)}</HeroeValor>
      </HeroeFintech>
    ) : null;

  return (
    <StepShellFintech
      titulo={rotuloPaso}
      paso={paso + 1}
      total={totalPasos()}
      onCancel={() => router.push(destino)}
      cancelDisabled={guardando}
      heroe={heroe}
      footer={
        <>
          <BotonPrincipal onClick={siguiente} disabled={guardando}>
            {guardando
              ? "Guardando..."
              : esConfirmacion
              ? "Crear trabajo"
              : "Siguiente"}
          </BotonPrincipal>
          {/* El `‹` de la cabecera cancela y sale; "Atrás" vuelve un paso. */}
          {paso > 0 && (
            <BotonSecundario onClick={volver} disabled={guardando}>
              Atrás
            </BotonSecundario>
          )}
        </>
      }
    >
        {paso === 0 && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            <TextField
              label="Nombre"
              value={estado.nombre}
              onChange={(v) => set({ nombre: v })}
              placeholder="Ej. Grand Cafe"
            />
            <DateField
              label="Fecha de inicio"
              value={estado.fechaInicio}
              onChange={(v) => set({ fechaInicio: v })}
            />
            <Campo label="Memos">
              <textarea
                rows={3}
                className={inputCls}
                value={estado.memos}
                onChange={(e) => set({ memos: e.target.value })}
                placeholder="Notas..."
              />
            </Campo>
          </div>
        )}

        {paso === 1 && (
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <Tarjeta
              activo={estado.tipoPago === "fijo"}
              onClick={() => {
                set({ tipoPago: "fijo", modalidadHoras: "", precioHora: "" });
                setPaso(2); // rama corta → confirmación
              }}
              titulo="Fijo por período"
              detalle="Cobrás un monto fijo por cada período, sin importar horas ni jornadas."
            />
            <Tarjeta
              activo={estado.tipoPago === "por_tarea"}
              onClick={() => {
                set({ tipoPago: "por_tarea", modalidadHoras: "", precioHora: "" });
                setPaso(2); // rama corta → confirmación
              }}
              titulo="Por tarea"
              detalle="Cada tarea se paga con su propio monto, sin depender del tiempo."
            />
            <Tarjeta
              activo={estado.tipoPago === "por_hora"}
              onClick={() => {
                set({ tipoPago: "por_hora" });
                setPaso(2); // rama larga → modalidad de horas
              }}
              titulo="Por hora"
              detalle="Se cobra según horas (fijas por período o variables por jornadas)."
            />
          </div>
        )}

        {paso === 2 && !ramaCorta && (
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <Tarjeta
              activo={estado.modalidadHoras === "horas_fijas"}
              onClick={() => set({ modalidadHoras: "horas_fijas" })}
              titulo="Horas fijas por período"
              detalle="La cantidad de horas se carga junto con el período (sin jornadas)."
            />
            <Tarjeta
              activo={estado.modalidadHoras === "horas_variables"}
              onClick={() => set({ modalidadHoras: "horas_variables" })}
              titulo="Horas variables (jornadas)"
              detalle="Se cargan horas en cada jornada + propina."
            />
          </div>
        )}

        {/* El input del precio vive en el **héroe** de la cabecera (arriba):
            acá queda solo la aclaración de para qué se usa. */}
        {paso === 3 && !ramaCorta && (
          <p className="rounded-xl border border-border bg-card p-4 text-[12px] leading-5 text-subtitle">
            Si elegís horas variables, este precio se usa al cargar cada jornada.
          </p>
        )}

        {esConfirmacion && (
          <div className="rounded-xl border border-border bg-card px-4 py-1">
            <Fila label="Nombre" value={estado.nombre} />
            <Fila
              label="Fecha de inicio"
              value={dateTimeToString(estado.fechaInicio)}
            />
            <Fila
              label="Tipo de pago"
              value={
                estado.tipoPago === "fijo"
                  ? "Fijo por período"
                  : estado.tipoPago === "por_tarea"
                  ? "Por tarea"
                  : "Por hora"
              }
            />
            {/* El **precio por hora** es el héroe de la cabecera: no se repite acá. */}
            {!ramaCorta && (
              <Fila
                label="Modalidad"
                value={
                  estado.modalidadHoras === "horas_fijas"
                    ? "Horas fijas por período"
                    : "Horas variables (jornadas)"
                }
              />
            )}
          </div>
        )}
    </StepShellFintech>
  );
}
