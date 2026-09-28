// TEMPORAL — verificación del parser de intenciones para "muéstrame los resultados".
const { parsearIntencion } = require("./voz/parse-intencion.js");

const frases = [
  "muéstrame los resultados",
  "mostrame los resultados",
  "mostrame el resultado",
  "andá a los resultados",
  "resultados",
  "quiero ver los resultados",
  "llévame a los resultados",
  "muéstrame el balance",
  "muéstrame los ingresos",
  "mostrame los prestamos",
];

for (const frase of frases) {
  const r = parsearIntencion(frase, {});
  console.log(
    JSON.stringify({
      frase,
      intencion: r.intencion?.id ?? null,
      panel: r.intencion?.panel ?? null,
      href: r.intencion ? r.intencion.href() : null,
      terminoDesconocido: r.terminoDesconocido ?? null,
      destinos: r.destinos?.length ?? 0,
      esConsulta: r.esConsulta ?? false,
    })
  );
}
