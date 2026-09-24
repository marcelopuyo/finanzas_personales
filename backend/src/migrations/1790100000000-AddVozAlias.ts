import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * **Vocabulario de voz** (2026-09-23 · G2 del plan de voz, `DeepSeek/plan-dictado-voz.md` §14).
 *
 * Crea `voz_alias`, la tabla que aprende cómo llama el usuario a las cosas y que
 * además soporta la **capa de SISTEMA** (disparadores comunes a todos los usuarios).
 *
 * Las dos capas conviven en la misma tabla, distinguidas por `usuarioId`:
 *
 * | Capa | `usuarioId` | `destinoValor` | Cómo resuelve |
 * |---|---|---|---|
 * | **Aprendida** (usuario) | el usuario | **id** de una opción (`categoriaGasto`, `cuenta`…) | Por **id**, contra las opciones ya cargadas |
 * | **Sistema** (curada) | **NULL** | **concepto** ("tabaco", "combustible"…) | Por **tokens de la etiqueta** del usuario (ver `lib/voz/vocabulario.ts`) |
 *
 * ⚠️ **Por qué el sistema apunta a conceptos y no a ids**: los ids son **por
 * usuario** (la categoría "Alimentacion" de uno no es la de otro) ⇒ una fila
 * global no puede apuntar a un id. En cambio "super" → *supermercado* sirve para
 * cualquiera cuyo catálogo tenga algo parecido.
 *
 * ⚠️ **Por qué un término del sistema puede tener VARIAS filas**: "super" apunta a
 * los conceptos *supermercado*, *alimentacion* y *compras* ⇒ el que resuelve mejor
 * contra el catálogo real gana. Los índices únicos son **parciales** para que esa
 * multiplicidad NO aplique a la capa del usuario (ahí rige el plan: una sola fila
 * viva por usuario + catálogo + término ⇒ reaprender = UPDATE).
 */
export class AddVozAlias1790100000000 implements MigrationInterface {
  name = "AddVozAlias1790100000000";

  /**
   * Capa de SISTEMA: **conceptos estándar** + la jerga con la que se los nombra.
   *
   * ⚠️ **Acá NO va el nombre de la categoría de ningún usuario.** Un concepto es
   * genérico (`tabaco`, `combustible`, `vivienda`…) y su lista son palabras que
   * cualquiera puede decir. La traducción concepto → categoría **real** ocurre en
   * memoria, en `lib/voz/vocabulario.ts`, comparando estos alias contra los
   * **tokens de las etiquetas del usuario** ⇒ "Diario - Cig" resuelve por el token
   * `cig` sin que el diccionario conozca esa categoría (y otro usuario con
   * "Cigarrillos" o "Vicios" se resuelve con el **mismo** concepto).
   *
   * Los términos van en forma **normalizada** (minúsculas, **sin tildes ni ñ**),
   * que es la misma que produce `norm()` en `lib/voz/normalizar.ts` antes de
   * comparar: "cumpleaños" se escribe `cumpleanos`.
   *
   * ➕ **Ampliar = agregar un alias a un concepto** (o un concepto nuevo). No hace
   * falta migrar de nuevo: son filas.
   *
   * 🎯 **Regla de oro para escribir alias**: que sean **distintivos**. Una palabra
   * que suela aparecer en etiquetas de OTRO concepto ("diario", "general",
   * "gastos", "cuota"…) crearía ambigüedad artificial. Ante la duda, no se agrega:
   * ese caso lo aprende el usuario con el uso (vías A/B del plan de G2).
   */
  private readonly SISTEMA: Record<string, Record<string, string[]>> = {
    // ── Categorías de gasto (26 conceptos) ─────────────────────────────────
    categoriaGasto: {
      alimentacion: [
        "super", "supermercado", "chino", "almacen", "mercado", "comestibles",
        "comida", "alimentacion", "autoservicio", "verduleria", "carniceria",
        "panaderia", "dietetica", "fiambreria",
      ],
      tabaco: [
        "tabaco", "cigarrillo", "cigarrillos", "cigarro", "cigarros", "pucho",
        "puchos", "cig", "fumar", "vicios",
      ],
      combustible: [
        "nafta", "combustible", "gasoil", "bencina", "diesel",
        "estacion de servicio", "surtidor", "ypf", "shell", "axion",
      ],
      transporte: [
        "transporte", "colectivo", "bondi", "sube", "subte", "tren", "taxi",
        "remis", "uber", "cabify", "didi", "peaje", "estacionamiento",
        "cochera", "garaje", "boleto",
      ],
      alquiler: ["alquiler", "renta", "arriendo", "arrendamiento"],
      vivienda: ["vivienda", "casa", "expensas", "consorcio", "hipoteca", "mudanza"],
      servicios: [
        "servicios", "luz", "electricidad", "edesur", "edenor", "gas", "agua",
        "internet", "cable", "telefono", "celular", "telefonia", "abl",
        "municipal", "basura", "residuos",
      ],
      impuestos: [
        "impuestos", "impuesto", "afip", "arba", "ganancias",
        "bienes personales", "monotributo", "iva", "ingresos brutos", "tasas",
        "contribuciones",
      ],
      salud: [
        "salud", "farmacia", "remedios", "medicamento", "medicamentos",
        "medico", "doctor", "obra social", "prepaga", "osde", "swiss medical",
        "galeno", "medife", "clinica", "hospital", "dentista", "odontologo",
        "kinesiologo", "psicologo", "terapia", "analisis", "laboratorio",
      ],
      indumentaria: [
        "ropa", "indumentaria", "vestimenta", "zapatillas", "calzado",
        "zapato", "zapateria", "prendas", "moda", "lenceria",
      ],
      cuidado_personal: [
        "cuidado personal", "peluqueria", "barberia", "estetica", "cosmetica",
        "cosmeticos", "perfumeria", "perfumes", "manicura", "pedicura",
        "depilacion", "spa", "maquillaje",
      ],
      deportes: [
        "deporte", "deportes", "gimnasio", "gym", "club", "cancha", "futbol",
        "pileta", "natacion", "yoga", "pilates", "crossfit",
      ],
      educacion: [
        "educacion", "colegio", "escuela", "jardin", "facultad", "universidad",
        "curso", "cursos", "capacitacion", "instituto", "academia", "clases",
        "apuntes", "utiles", "matricula",
      ],
      ocio: [
        "ocio", "recreacion", "salida", "salidas", "entretenimiento", "cine",
        "teatro", "bar", "restaurante", "restaurant", "recital", "concierto",
        "fiesta", "juego", "juegos", "libros", "libreria", "museo",
      ],
      suscripciones: [
        "suscripcion", "suscripciones", "membresia", "membresias", "abono",
        "streaming", "netflix", "spotify", "hbo", "disney", "prime video",
        "amazon prime", "youtube premium",
      ],
      viajes: [
        "viaje", "viajes", "vacaciones", "turismo", "hotel", "pasaje",
        "pasajes", "vuelo", "vuelos", "excursion", "veraneo", "airbnb", "booking",
      ],
      mascotas: [
        "mascota", "mascotas", "perro", "gato", "veterinaria", "veterinario",
        "balanceado", "piedritas", "animales",
      ],
      regalos: [
        "regalo", "regalos", "obsequio", "obsequios", "presente", "presentes",
        "cumpleanos",
      ],
      compras: [
        "compras", "compra", "shopping", "shoping", "articulos", "cosas",
        "bazar", "ferreteria", "decoracion", "muebles", "electrodomesticos",
      ],
      tecnologia: [
        "tecnologia", "electronica", "computadora", "computacion", "notebook",
        "tablet", "hardware", "software", "hosting", "dominio", "gadgets",
      ],
      tarjeta: [
        "tarjeta", "tarjetas", "tarjeta de credito", "credito", "plastico",
        "visa", "master", "mastercard", "amex", "american express", "resumen",
        "cuotas", "refinanciacion",
      ],
      comisiones: [
        "comision", "comisiones", "gastos bancarios", "bancarios", "bancario",
        "mantenimiento", "administracion de cuenta", "sellado", "sello",
        "cheques", "cambio de cheques", "comision de cambio",
        "comision de envio", "envio de dinero", "envio", "impuesto al cheque",
      ],
      seguros: [
        "seguro", "seguros", "poliza", "polizas", "seguro de vida",
        "seguro del hogar", "seguro del auto",
      ],
      vehiculo: [
        "vehiculo", "auto", "coche", "automotor", "patente", "patentes", "vtv",
        "mecanico", "taller", "service", "repuesto", "repuestos", "reparacion",
        "multa", "multas", "lavadero", "cubiertas",
      ],
      limpieza: [
        "limpieza", "limpiador", "limpiadores", "detergente", "lavanderia",
        "tintoreria",
      ],
      otros: [
        "otros", "otro", "varios", "miscelaneo", "miscelaneos", "imprevisto",
        "imprevistos",
      ],
    },
    // ── Cuentas (5 conceptos) ──────────────────────────────────────────────
    // `cuenta_*` = **tipo de cuenta**, no el nombre de una cuenta real. Los
    // canales (banco/billetera virtual/efectivo) sí son vocabulario público;
    // una cuenta con nombre propio ("Cuenta Alexis") NO va acá: se aprende.
    cuenta: {
      cuenta_efectivo: [
        "efectivo", "cash", "plata", "mano", "caja",
      ],
      cuenta_banco: [
        "banco", "bco", "caja de ahorro", "cuenta corriente", "galicia",
        "santander", "bbva", "nacion", "provincia", "macro", "hsbc", "icbc",
        "supervielle", "credicoop", "brubank", "truist",
      ],
      cuenta_billetera_virtual: [
        "billetera", "billetera virtual", "virtual", "mercado pago",
        "mercadopago", "mp", "uala", "naranja", "personal pay", "modo",
        "cuenta dni",
      ],
      cuenta_por_cobrar: [
        "por cobrar", "a cobrar", "pendiente", "pendientes", "deudores",
        "cobros", "a favor",
      ],
      cuenta_inversion: [
        "inversion", "inversiones", "plazo fijo", "fci", "fondo", "fondos",
        "acciones", "cedears", "cedear", "bonos", "broker", "cripto",
        "criptomonedas", "bitcoin",
      ],
    },
  };

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "voz_alias" (
        "id" SERIAL NOT NULL,
        "usuarioId" integer,
        "ambito" character varying(40) NOT NULL,
        "termino" character varying(80) NOT NULL,
        "terminoNorm" character varying(80) NOT NULL,
        "destinoValor" character varying(120) NOT NULL,
        "destinoEtiqueta" character varying(120) NOT NULL,
        "origen" character varying(20) NOT NULL,
        "usos" integer NOT NULL DEFAULT 0,
        "correcciones" integer NOT NULL DEFAULT 0,
        "activo" boolean NOT NULL DEFAULT true,
        "eliminado" boolean NOT NULL DEFAULT false,
        "creadoEn" TIMESTAMP NOT NULL DEFAULT now(),
        "actualizadoEn" TIMESTAMP,
        CONSTRAINT "PK_voz_alias" PRIMARY KEY ("id")
      )`
    );

    // Al borrar el usuario se va su vocabulario aprendido (no queda basura).
    // `usuarioId` NULL = capa de sistema ⇒ la FK lo permite.
    await queryRunner.query(
      `ALTER TABLE "voz_alias"
         ADD CONSTRAINT "FK_voz_alias_usuario"
         FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id")
         ON DELETE CASCADE ON UPDATE NO ACTION`
    );

    // Capa del USUARIO: una sola fila viva por (usuario, catálogo, término)
    // ⇒ reaprender es un UPDATE, no acumula basura.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_voz_alias_usuario_termino"
         ON "voz_alias" ("usuarioId", "ambito", "terminoNorm")
         WHERE "eliminado" = false AND "usuarioId" IS NOT NULL`
    );

    // Capa de SISTEMA: una fila viva por (catálogo, término, destino) ⇒ un mismo
    // término puede ofrecer varios conceptos candidatos.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_voz_alias_sistema_termino"
         ON "voz_alias" ("ambito", "terminoNorm", "destinoValor")
         WHERE "eliminado" = false AND "usuarioId" IS NULL`
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_voz_alias_usuario" ON "voz_alias" ("usuarioId")`
    );

    // RLS como el resto de las tablas (la app entra como `postgres`, que la saltea;
    // sin policies, `anon`/`authenticated` quedan bloqueados).
    await queryRunner.query(
      `ALTER TABLE "voz_alias" ENABLE ROW LEVEL SECURITY`
    );

    // ── Seed de la capa de SISTEMA ─────────────────────────────────────────
    // Una fila por **alias**; `destinoValor` = el **concepto** (no un id).
    for (const [ambito, conceptos] of Object.entries(this.SISTEMA)) {
      for (const [concepto, alias] of Object.entries(conceptos)) {
        for (const termino of alias) {
          await queryRunner.query(
            `INSERT INTO "voz_alias"
               ("usuarioId", "ambito", "termino", "terminoNorm", "destinoValor",
                "destinoEtiqueta", "origen", "usos", "correcciones", "activo", "eliminado")
             VALUES (NULL, $1, $2, $3, $4, $4, 'sistema', 0, 0, true, false)
             ON CONFLICT DO NOTHING`,
            [ambito, termino, termino, concepto]
          );
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Se pierde el vocabulario aprendido (se vuelve a aprender con el uso); la
    // capa de sistema se vuelve a sembrar si se re-aplica la migración.
    await queryRunner.query(`DROP TABLE "voz_alias"`);
  }
}
