"use client";

import { useEffect, useState } from "react";
import { ANCLA_TOPE, registrarIrAlPanel } from "@/lib/panel-scroll";

// Posición de scroll del dashboard en una VARIABLE INTERNA del módulo (memoria
// del cliente): sobrevive a la navegación interna porque el módulo JS no se
// recarga al cambiar de ruta, pero se resetea con un refresh completo de la
// página → al recargar el dashboard siempre arranca en el tope. NO usa
// localStorage, sessionStorage ni cookies.
let dashboardScrollTop = 0;

/** Tiempo máximo durante el que se sigue reintentando la restauración (ms). */
const RESTORE_MS = 2000;

/** Aire (px) que se deja arriba del panel al que se llega por voz. */
const MARGEN_PANEL = 8;

/**
 * Restaura la posición de scroll del dashboard al volver desde otro CRUD
 * (p. ej. el botón "volver" de la grilla con ?origen=dashboard).
 *
 * El scroll de la app vive en el <main> interno (overflow-y-auto del AppLayout),
 * NO en la ventana: la restauración automática del navegador/Next no aplica y
 * hay que guardar/restaurar el scrollTop a mano.
 *
 * ⚠️ Clave: **no alcanza con restaurar una sola vez**. El dashboard se pinta por
 * partes (los gráficos y las tarjetas con datos llegan DESPUÉS del primer
 * paint), así que un único `scrollTo` al montar queda "clampeado" a la altura
 * que el contenedor tiene en ESE momento y, cuando el contenido termina de
 * crecer, la posición se queda donde la dejó el clamp en vez de volver a donde
 * estaba el usuario. Verificado 2026-09-13: con el dashboard en 2500px, el
 * retroceso desde /cruds/periodos-trabajo lo dejaba en **736px**. Por eso la
 * restauración se REINTENTA cuadro a cuadro hasta que el contenedor pueda llegar
 * al destino (o hasta agotar `RESTORE_MS`).
 *
 * Mientras el dashboard está montado guarda continuamente el scrollTop en la
 * variable interna (leerlo en el unmount no es confiable porque el DOM del
 * <main> ya puede haber cambiado al swap de ruta); al montarse de nuevo (al
 * volver a /dashboard) restaura la posición. Vive únicamente en la página del
 * dashboard.
 */
export function DashboardScrollKeeper({ panel }: { panel?: string }) {
  /**
   * Ancla pedida **sin navegar**: el FAB 🎤 (u otra orden de voz) ya estando en el
   * dashboard pide "llevame al panel X" por `lib/panel-scroll.ts` y se atiende acá.
   *
   * ⚠️ El contador `n` no es decorativo: es lo que hace que **repetir la misma
   * orden** vuelva a scrollear. Sin él, pedir otra vez el panel ya pedido no
   * cambiaría el estado y el efecto de abajo (que depende de esto) no volvería a
   * correr — así se rompía en el celular (2026-09-25): la URL quedaba en
   * `?panel=prestamos`, `router.push` a la misma URL es un no-op y la orden
   * "navega a los préstamos" no hacía nada.
   */
  const [pedido, setPedido] = useState<{ panel: string; n: number } | null>(null);

  // El canal del FAB: pide un panel y lo resuelve el efecto de abajo. Se registra
  // atado al montaje (al salir del dashboard queda vacío y la orden vuelve a
  // navegar como siempre).
  useEffect(
    () =>
      registrarIrAlPanel((ancla) =>
        setPedido((prev) => ({ panel: ancla, n: (prev?.n ?? 0) + 1 }))
      ),
    []
  );

  useEffect(() => {
    const main = document.querySelector<HTMLElement>("main");
    if (!main) return;

    /**
     * Ancla que hay que dejar a la vista: la que pidió el FAB **ahora** (scroll
     * sin navegar) o, al navegar/recargar, la del `?panel=` de la URL.
     */
    const ancla = pedido?.panel ?? panel;

    /**
     * Offset del ancla dentro del `<main>`, que es quien scrollea. Se recalcula en
     * cada intento porque el dashboard crece por partes (los gráficos y las
     * tarjetas llegan después del primer paint).
     *
     * `null` = todavía no está en el DOM (p. ej. **Resultados** sólo existe si hay
     * datos) ⇒ se apunta al tope del dashboard, que es lo menos confuso (dejarlo
     * donde estaba sería peor: la orden fue "mostrame esto").
     */
    const objetivoPanel = () => {
      if (!ancla) return null;
      if (ancla === ANCLA_TOPE) return 0;
      const el = main.querySelector<HTMLElement>(`[data-panel="${ancla}"]`);
      if (!el) return null;
      return (
        el.getBoundingClientRect().top -
        main.getBoundingClientRect().top +
        main.scrollTop -
        MARGEN_PANEL
      );
    };

    /** Posición que hay que alcanzar (la que tenía el usuario al irse). */
    const destino = dashboardScrollTop;
    /** Última posición pedida por NOSOTROS (para distinguirla de la del usuario). */
    let ultimoPedido = -1;
    /** El usuario scrolleó: se corta la restauración para no pelear con él. */
    let cancelado = false;
    /** Altura del contenido en el último scroll visto (para detectar "clamps"). */
    let ultimaAltura = main.scrollHeight;

    const save = () => {
      dashboardScrollTop = main.scrollTop;
    };

    // Guarda la posición que scrollea el usuario. Se ignoran dos casos que NO son
    // del usuario:
    //  · nuestro propio ajuste programático (tolerancia de 2px por redondeos);
    //  · el CLAMP que hace el navegador al achicarse el contenido en el cambio de
    //    ruta (2500px → 0/736px al desmontarse el dashboard). Si ese clamp se
    //    guardara, al volver se restauraría la posición equivocada (o el tope).
    const onScroll = () => {
      const altura = main.scrollHeight;
      const achico = altura < ultimaAltura;
      ultimaAltura = altura;
      if (Math.abs(main.scrollTop - ultimoPedido) <= 2) return;
      if (achico && main.scrollTop < dashboardScrollTop) return;
      cancelado = true;
      save();
    };

    let raf = 0;
    const fin = performance.now() + RESTORE_MS;

    const restaurar = () => {
      if (cancelado) return;
      const max = main.scrollHeight - main.clientHeight;
      // Con ancla manda el panel (y si no existe todavía se deja el dashboard en
      // el tope: **no** se restaura la posición vieja, que sería confuso).
      const objetivo = ancla
        ? Math.max(0, Math.min(objetivoPanel() ?? 0, max))
        : Math.min(destino, max);
      if (Math.abs(main.scrollTop - objetivo) > 1) {
        ultimoPedido = objetivo;
        main.scrollTo(0, objetivo);
      }
      // Se deja de insistir cuando ya se llegó al destino (el contenido terminó de
      // crecer) o cuando se agotó el tiempo. Con ancla se insiste todo el tiempo:
      // el panel puede entrar al DOM más tarde (o nunca).
      if (ancla) {
        if (performance.now() > fin) return;
      } else if (max >= destino || performance.now() > fin) {
        return;
      }
      raf = requestAnimationFrame(restaurar);
    };

    // Restaurar/ir al panel SOLO si hay algo que hacer: una posición guardada del
    // último paso por el dashboard, o un panel pedido por voz.
    // OJO: no llamar a save() antes de restaurar: al montar el <main> arranca en
    // scrollTop 0 y pisaría el valor guardado (por eso nunca restauraba).
    if (destino > 0 || ancla) raf = requestAnimationFrame(restaurar);

    main.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      main.removeEventListener("scroll", onScroll);
    };
    // `ancla` entra en las deps (por `panel` de la URL y por `pedido`): estando ya
    // en el dashboard, pedir un panel (o el mismo otra vez) tiene que volver a
    // correr el efecto.
  }, [panel, pedido]);

  return null;
}
