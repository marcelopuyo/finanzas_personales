"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CuentaSlide } from "./cuenta-slide";
import { AporteCuentasLista } from "./aporte-cuentas-lista";
import { MovimientosCuentaClient } from "@/app/(app)/cuentas/[id]/movimientos-client";
import { calcularAportes } from "../aportes-balance";
import { getHistorialesPrimerasPaginasAction } from "@/backend/src/actions/historial-movimientos";
import type { HistorialPagina } from "@/backend/src/queries/movimientos";
import {
  PRIMERA_PAGINA_FILAS,
  guardarPrimeraPagina,
  leerPrimeraPagina,
  suscribirHistoriales,
} from "@/lib/historial-cuentas";
import type { DashboardData } from "../dashboard-data";
import { cn, numberToCurrency } from "@/lib/utils";
import { setTopbarScrolled } from "@/lib/topbar-scroll";

/**
 * **Pantalla Inicio** (`/dashboard`) — banda (hero) + carrusel de cuentas
 * (2026-10-02, rama `rediseno-ui`).
 *
 * Rediseño pedido por el usuario a partir de una referencia de app bancaria:
 *
 * 1. **Banda a sangre** (`bg-muted`) que arranca en el borde superior y
 *    **contiene la top bar** ⇒ en el top no hay separación entre la barra y el
 *    resto (la barra se pinta **transparente** desde `components/layout/top-bar.tsx`
 *    y pasa a **translúcida con blur** al scrollear).
 * 2. **Carrusel full-width, 1 cuenta por vista, SIN *peek*** (decisión del
 *    usuario): cada slide trae el bloque completo —nombre + saldo + gráfico +
 *    acciones— y al deslizar cambia todo junto.
 * 3. **Dots** dentro de la banda, abajo de las acciones.
 * 4. Debajo de la banda, el **detalle de la tarjeta en foco**: el historial de la
 *    cuenta (`MovimientosCuentaClient` de `/cuentas/[id]`, con scroll infinito) o,
 *    si el foco es el resumen, el **aporte de cada cuenta al balance** (saldo + %,
 *    de mayor a menor — `aporte-cuentas-lista.tsx`).
 *
 * 🔑 La tarjeta en foco la define **solo el swipe** (se guarda en `sessionStorage`
 *    para volver a la misma cuenta tras remontar). La **primera** tarjeta es el
 *    **resumen (Balance Actual)**, con la **dona de aporte por cuenta** (decisión
 *    del usuario 2026-10-03: antes era la evolución de Resultados, que pasó al
 *    panel **Resultados** de la barra inferior).
 *
 * ⚠️ **Lazy "sticky"**: el gráfico se monta al acercarse el foco y, una vez
 * montado, **no se desmonta** (montar Recharts es lo caro ⇒ evita el skeleton al
 * volver a una tarjeta). El resto se premonta en segundo plano; solo los nunca
 * vistos reservan el alto con un `Skeleton` hasta acercarse.
 *
 * ⚠️ Se eliminaron los **FAB** de Inicio: las acciones viven **dentro de cada
 * slide** (mismas 3 del FAB "+" en las cuentas y `Gestionar cuentas` en el resumen).
 */
const PAGINA_VACIA: HistorialPagina = { rows: [], total: 0, hayMas: true };

/** Px de scroll a partir de los cuales la top bar se "despega" (translúcida). */
const UMBRAL_TOPBAR_PX = 8;

/** `window` con `requestIdleCallback` (no está en todos los navegadores). */
type VentanaIdle = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
};

/**
 * Ejecuta `fn` cuando el hilo principal queda libre, para no competir con el
 * primer pintado. Respaldo con `setTimeout` en navegadores sin
 * `requestIdleCallback` (p. ej. Safari).
 */
function alIdle(fn: () => void) {
  if (typeof window === "undefined") return;
  const ric = (window as VentanaIdle).requestIdleCallback;
  if (typeof ric === "function") ric(() => fn(), { timeout: 1500 });
  else setTimeout(fn, 200);
}

/**
 * Clave de `sessionStorage` con la **tarjeta en foco** (`"0"` = Balance,
 * 1..N = cuenta): es por pestaña y sobrevive al remontaje de la pantalla ⇒ al
 * volver del wizard el carrusel queda en la MISMA cuenta con la que se entró.
 */
const CLAVE_FOCO = "fp_inicio_foco";

/** Tarjeta guardada (`0` = Balance si no hay nada o si el storage está bloqueado). */
function leerFocoGuardado(): number {
  try {
    const n = Number(sessionStorage.getItem(CLAVE_FOCO));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Guarda la tarjeta en foco (mejor esfuerzo: si falla, no es crítico). */
function guardarFoco(indice: number) {
  try {
    sessionStorage.setItem(CLAVE_FOCO, String(indice));
  } catch {
    /* sin sessionStorage simplemente no se restaura */
  }
}

interface InicioPanelProps {
  data: DashboardData;
  /**
   * Primera página del historial de las **2 primeras** cuentas, resuelta en el
   * server (así Inicio abre con datos y la vecina ya está lista). El resto se
   * precarga en segundo plano desde el cliente.
   */
  historialesIniciales: Record<number, HistorialPagina>;
}

export function InicioPanel({ data, historialesIniciales }: InicioPanelProps) {
  // Solo cuentas reales (las tarjetas sin `id` no tienen historial que mostrar).
  const cuentas = useMemo(
    () =>
      data.cuentas.filter(
        (c): c is DashboardData["cuentas"][number] & { id: number } =>
          c.id != null
      ),
    [data.cuentas]
  );
  /**
   * **Aporte de cada cuenta al Balance Actual** (ordenado de mayor a menor):
   * alimenta la **dona** de la tarjeta 0 y su **listado** de abajo.
   */
  const aportes = useMemo(() => calcularAportes(data.cuentas), [data.cuentas]);
  const [foco, setFoco] = useState(0);
  /**
   * Índice más alto cuyos **gráficos** deben estar montados. Crece con el foco (y
   * en segundo plano) y **nunca decrece**: una vez montado, el gráfico no se
   * desmonta, así volver a una tarjeta ya vista no vuelve a mostrar el skeleton.
   */
  const [montadosHasta, setMontadosHasta] = useState(1);
  const trackRef = useRef<HTMLDivElement | null>(null);
  /** ¿Ya se intentó restaurar la tarjeta guardada? (una sola vez por montaje). */
  const restauradoRef = useRef(false);
  /**
   * Cuenta en foco, en un **ref**: la precarga no debe pedir la cuenta que el
   * listado ya está pidiendo por su cuenta (evita el pedido duplicado). Se
   * actualiza en el ref callback y en el scroll, no en el render.
   */
  const focoIdRef = useRef<number | null>(null);
  /** Desplazamiento programático del carrusel en curso (`irACuenta`). */
  const saltoRef = useRef(false);
  /**
   * ¿Ya manda la caché de primeras páginas? Antes de hidratar se leen las props
   * del server (evita desajuste de hidratación); después manda solo la caché, así
   * una invalidación por mutación **no** revive la página vieja de las props.
   */
  const [listo, setListo] = useState(false);

  /**
   * Tarjetas del carrusel: la **0 es el Balance Actual** (siempre la primera, la
   * que se ve a la entrada) y de la 1 en adelante las cuentas.
   */
  const totalTarjetas = cuentas.length + 1;
  const indice = Math.min(foco, Math.max(0, totalTarjetas - 1));
  /** Cuenta en foco (`undefined` cuando la tarjeta en foco es la del balance). */
  const cuenta = indice === 0 ? undefined : cuentas[indice - 1];

  /** Re-render cuando cambia la caché de primeras páginas (precarga, fetch...). */
  const [, bump] = useState(0);
  useEffect(() => suscribirHistoriales(() => bump((n) => n + 1)), []);

  /**
   * Siembra la caché con las páginas que resolvió el server y enciende `listo`
   * (a partir de ahí la caché es la única fuente). Va diferido con `setTimeout`
   * para mantener los `setState` fuera del cuerpo del efecto
   * (`react-hooks/set-state-in-effect`, §114).
   */
  useEffect(() => {
    const t = setTimeout(() => {
      for (const [id, pagina] of Object.entries(historialesIniciales)) {
        guardarPrimeraPagina(Number(id), pagina);
      }
      setListo(true);
    }, 0);
    return () => clearTimeout(t);
  }, [historialesIniciales]);

  /**
   * Clave de la última precarga disparada: evita repetirla cuando el efecto
   * vuelve a correr con el mismo conjunto de cuentas (el doble montaje de
   * `StrictMode` en dev haría 2 llamadas idénticas).
   */
  const precargaClaveRef = useRef<string | null>(null);

  /**
   * Precarga en segundo plano la 1ª página de las cuentas que **falten**: ni las
   * 2 que ya sembró el server (`historialesIniciales`), ni la que está en foco
   * (el listado la pide por su cuenta), ni las que ya estén en caché. Todo en
   * **una sola** llamada, así el 3er swipe y siguientes abren con datos.
   */
  useEffect(() => {
    const faltantes = cuentas
      .map((c) => c.id)
      .filter(
        (id): id is number =>
          id != null &&
          id !== focoIdRef.current &&
          historialesIniciales[id] == null &&
          !leerPrimeraPagina(id)
      );
    if (faltantes.length === 0) return;
    const clave = faltantes.join(",");
    if (precargaClaveRef.current === clave) return;
    precargaClaveRef.current = clave;
    alIdle(() => {
      void (async () => {
        try {
          const paginas = await getHistorialesPrimerasPaginasAction(
            faltantes,
            PRIMERA_PAGINA_FILAS
          );
          // Se guardan SIEMPRE, aunque el efecto se haya limpiado mientras
          // viajaba el pedido (doble montaje de `StrictMode` en dev): la caché es
          // de módulo y el trabajo ya está hecho — lo que sigue es una mutación
          // de la caché, no un `setState`, así que no hay nada que cancelar.
          // Descartarlo dejaba la caché vacía y el listado volvía a pedir su
          // primera página al server al enfocar cada cuenta (medido 2026-10-03).
          for (const [id, pagina] of Object.entries(paginas)) {
            guardarPrimeraPagina(Number(id), pagina);
          }
        } catch {
          // Falla la precarga: se libera la clave para reintentar y el listado
          // pedirá su primera página al enfocarse.
          precargaClaveRef.current = null;
        }
      })();
    });
  }, [cuentas, historialesIniciales]);

  /**
   * Premontaje perezoso del resto de los gráficos, de a uno por vez y en tiempo
   * libre. Con `montadosHasta` como dependencia, cada ciclo avanza uno más.
   */
  useEffect(() => {
    if (montadosHasta >= totalTarjetas - 1) return;
    let cancelado = false;
    alIdle(() => {
      if (!cancelado) {
        setMontadosHasta((v) => Math.min(v + 1, totalTarjetas - 1));
      }
    });
    return () => {
      cancelado = true;
    };
  }, [montadosHasta, totalTarjetas]);

  /**
   * Ref del track del carrusel: guarda el nodo **y restaura la tarjeta en foco**
   * guardada en `sessionStorage`. Va en un **ref callback** (fase de commit) y no
   * en un efecto: `sessionStorage` no existe en el server (leerlo en el render
   * sería un desajuste de hidratación) y así el `scrollLeft` queda aplicado **antes
   * del primer pintado**.
   */
  const montarTrack = useCallback(
    (node: HTMLDivElement | null) => {
      trackRef.current = node;
      if (!node || restauradoRef.current) return;
      restauradoRef.current = true;
      const i = Math.min(leerFocoGuardado(), totalTarjetas - 1);
      focoIdRef.current = i === 0 ? null : cuentas[i - 1]?.id ?? null;
      if (i <= 0) return;
      node.scrollLeft = i * node.clientWidth;
      setFoco(i);
      setMontadosHasta((v) => Math.max(v, i + 1));
    },
    [totalTarjetas, cuentas]
  );

  /**
   * Índice enfocado a partir del scroll del carrusel. Cada slide ocupa el **100 %
   * del ancho** (sin *peek* y sin gap) ⇒ el paso es `clientWidth`.
   */
  /**
   * **Índice enfocado a partir del scroll** del carrusel. Cada slide ocupa el
   * **100 % del ancho** (sin *peek* y sin gap) ⇒ el paso es `clientWidth`.
   */
  const sincronizarIndice = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const paso = el.clientWidth || 1;
    const i = Math.max(
      0,
      Math.min(totalTarjetas - 1, Math.round(el.scrollLeft / paso))
    );
    focoIdRef.current = i === 0 ? null : cuentas[i - 1]?.id ?? null;
    if (i === foco) return;
    setFoco(i);
    setMontadosHasta((v) => Math.max(v, i + 1));
    guardarFoco(i);
  }, [cuentas, foco, totalTarjetas]);

  const onScroll = () => {
    // Desplazamiento programático en curso (ver `irACuenta`): el destino ya está
    // fijado ⇒ no se recalcula el foco con los pasos intermedios (evita que el
    // detalle de abajo se monte cuenta por cuenta durante la animación).
    if (saltoRef.current) return;
    sincronizarIndice();
  };

  /**
   * **Tocar una fila del listado de aporte** (tarjeta de *Balance Actual*)
   * desplaza el carrusel a la tarjeta de esa cuenta (pedido del usuario,
   * 2026-10-03): el detalle de abajo pasa a ser su historial de movimientos.
   */
  const irACuenta = useCallback(
    (cuentasId: number) => {
      const i = cuentas.findIndex((c) => c.id === cuentasId);
      if (i < 0) return;
      const destino = i + 1;
      setFoco(destino);
      focoIdRef.current = cuentasId;
      setMontadosHasta((v) => Math.max(v, destino + 1));
      guardarFoco(destino);
      const el = trackRef.current;
      if (!el) return;
      // Posición del slide (no `destino * clientWidth`): es exacta y no acumula
      // el redondeo del ancho.
      const slide = el.children[destino] as HTMLElement | undefined;
      el.scrollTo({
        left: slide ? slide.offsetLeft : destino * (el.clientWidth || 1),
        behavior: "smooth",
      });
      // Se ignora el `onScroll` hasta que la animación termina (o casi): si no,
      // los pasos intermedios re-montarían el detalle de cada cuenta.
      saltoRef.current = true;
      window.setTimeout(() => {
        saltoRef.current = false;
        // **Re-afinado**: al aterrizar, el detail de abajo cambia de alto y
        // puede aparecer/desaparecer la barra de scroll ⇒ el carrusel se angosta
        // **a mitad del desplazamiento** y la tarjeta queda corrida (~15 px por
        // tarjeta, medido el 2026-10-03 en un viewport de 390 px). Se corrige sin
        // animación, y **solo** si el desfase es chico: si el usuario ya se movió
        // por su cuenta, su gesto manda.
        const track = trackRef.current;
        const objetivo = track?.children[destino] as HTMLElement | undefined;
        if (track && objetivo) {
          const desfase =
            objetivo.getBoundingClientRect().left -
            track.getBoundingClientRect().left;
          if (
            Math.abs(desfase) > 1 &&
            Math.abs(desfase) < track.clientWidth / 2
          ) {
            track.scrollLeft += desfase;
          }
        }
        sincronizarIndice();
      }, 800);
    },
    [cuentas, sincronizarIndice]
  );

  /**
   * **Top bar**: marca en el `<html>` si el contenido salió del tope (para que la
   * barra pase de transparente a translúcida — ver `globals.css`). Se escucha el
   * `scroll` del **`<main>` interno** (es quien scrollea; la ventana no) y se llama
   * al setter en cada evento (el toggle de `classList` es idempotente y barato).
   */
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("main");
    if (!root) return;
    const onScroll = () => setTopbarScrolled(root.scrollTop > UMBRAL_TOPBAR_PX);
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      // Al salir de Inicio la barra vuelve a su estado transparente.
      setTopbarScrolled(false);
    };
  }, []);

  return (
    // A sangre: cancela el padding del `<main>` (px-4/lg:px-6 + pt-[--app-top])
    // para que la banda llegue hasta los bordes y hasta arriba de todo.
    //
    // ⚠️ `--app-top` está en px de **dispositivo** (tiene que coincidir con la
    // barra superior, que no se escala) y estas dos medidas viven **dentro** de la
    // capa de zoom ⇒ se dividen por `--fp-zoom` (zoom propio del contenido,
    // `components/layout/zoom-contenido.tsx`). Sin la división, con zoom 200 % la
    // banda dejaba 3.5rem de aire de más arriba.
    <div className="-mx-4 -mt-[calc(var(--app-top)/var(--fp-zoom,1))] lg:-mx-6">
      {/* ───────── BANDA (hero) ───────── */}
      <div
        data-inicio-hero=""
        className="relative border-b border-border bg-muted"
        style={{ paddingTop: "calc(var(--app-top) / var(--fp-zoom, 1))" }}
      >
        {/* Carrusel: full-width, una tarjeta por vista, snap sin peek ni gap. */}
        <div
          ref={montarTrack}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <CuentaSlide
            titulo="Balance Actual"
            monto={numberToCurrency(data.balance, data.monedaPredeterminadaISO)}
            esBalance
            aporte={aportes}
            monedaISO={data.monedaPredeterminadaISO}
            conGrafico
          />
          {cuentas.map((c, i) => {
            const idx = i + 1;
            return (
              <CuentaSlide
                key={c.id}
                titulo={c.title}
                monto={c.value}
                esBalance={false}
                evolucion={(c.values ?? []).map((v, k) => ({
                  name: c.labels?.[k] ?? "",
                  value: v,
                }))}
                monedaISO={c.monedaISO ?? data.monedaPredeterminadaISO}
                cuentaId={c.id ?? undefined}
                conGrafico={idx <= montadosHasta}
              />
            );
          })}
        </div>

        {/* Dots: dentro de la banda, abajo de las acciones. En **monocromo** desde
            el 2026-10-03 (el activo era azul `--primary`: el usuario pidió sacar el
            azul de la barra y de este carrusel; el activo ahora es un blanco más
            ancho, igual que el tab activo de la barra inferior). */}
        <div className="mt-1.5 flex items-center justify-center gap-1.5 pb-1.5">
          {Array.from({ length: totalTarjetas }).map((_, i) => (
            <i
              key={i}
              aria-hidden="true"
              className={cn(
                "block h-1.5 rounded-full",
                i === indice ? "w-4.5 bg-header" : "w-1.5 bg-border"
              )}
            />
          ))}
        </div>
      </div>

      {/* ── Debajo de la banda: detalle de la tarjeta en foco ── */}
      <div className="px-4 pt-4 lg:px-6">
        {cuentas.length === 0 && (
          <p className="mb-3 rounded-2xl border border-border bg-card px-4 py-3 text-[13px] text-subtitle">
            No hay cuentas cargadas.
          </p>
        )}
        {indice === 0 ? (
          /* Foco = resumen: el aporte de cada cuenta al balance, de mayor a menor. */
          <AporteCuentasLista
            data={aportes}
            currency={data.monedaPredeterminadaISO}
            onIrACuenta={irACuenta}
          />
        ) : cuenta ? (
          <MovimientosCuentaClient
            key={cuenta.id}
            embebido
            cuenta={{
              id: cuenta.id!,
              nombre: cuenta.title,
              saldo: 0,
              monedaISO: cuenta.monedaISO ?? data.monedaPredeterminadaISO,
            }}
            primeraPagina={
              (listo
                ? leerPrimeraPagina(cuenta.id)
                : historialesIniciales[cuenta.id]) ?? PAGINA_VACIA
            }
            monedaPredeterminadaISO={data.monedaPredeterminadaISO}
          />
        ) : null}
      </div>
    </div>
  );
}
