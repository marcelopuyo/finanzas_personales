"use client";

import { useEffect } from "react";

// Posición de scroll del dashboard en una VARIABLE INTERNA del módulo (memoria
// del cliente): sobrevive a la navegación interna porque el módulo JS no se
// recarga al cambiar de ruta, pero se resetea con un refresh completo de la
// página → al recargar el dashboard siempre arranca en el tope. NO usa
// localStorage, sessionStorage ni cookies.
let dashboardScrollTop = 0;

/** Tiempo máximo durante el que se sigue reintentando la restauración (ms). */
const RESTORE_MS = 2000;

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
export function DashboardScrollKeeper() {
  useEffect(() => {
    const main = document.querySelector<HTMLElement>("main");
    if (!main) return;

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
      const objetivo = Math.min(destino, max);
      if (Math.abs(main.scrollTop - objetivo) > 1) {
        ultimoPedido = objetivo;
        main.scrollTo(0, objetivo);
      }
      // Ya se puede llegar al destino (el contenido terminó de crecer) o se
      // agotó el tiempo: se deja de insistir.
      if (max >= destino || performance.now() > fin) return;
      raf = requestAnimationFrame(restaurar);
    };

    // Restaurar SOLO si hay algo guardado del último paso por el dashboard.
    // OJO: no llamar a save() antes de restaurar: al montar el <main> arranca en
    // scrollTop 0 y pisaría el valor guardado (por eso nunca restauraba).
    if (destino > 0) raf = requestAnimationFrame(restaurar);

    main.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      main.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}
