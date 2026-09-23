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
 * | **Sistema** (curada) | **NULL** | **concepto** ("supermercado", "alimentacion") | Por **parecido** contra las opciones del usuario |
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
   * Capa de SISTEMA: términos coloquiales → **conceptos candidatos**.
   *
   * Los términos van en forma **normalizada** (minúsculas, sin tildes), que es la
   * misma que produce `norm()` en `lib/voz/normalizar.ts` antes de comparar.
   * Ampliar esta capa = agregar filas (no hace falta migrar de nuevo).
   */
  private readonly SISTEMA: Record<string, Record<string, string[]>> = {
    // ── Categorías de gasto ────────────────────────────────────────────────
    categoriaGasto: {
      super: ["supermercado", "alimentacion", "compras"],
      supermercado: ["supermercado", "alimentacion"],
      chino: ["supermercado", "alimentacion"],
      almacen: ["almacen", "supermercado", "alimentacion"],
      mercado: ["mercado", "supermercado"],
      comestibles: ["alimentacion", "supermercado"],
      comida: ["alimentacion", "comida"],
      alimentacion: ["alimentacion"],
      nafta: ["combustible", "transporte"],
      bencina: ["combustible"],
      gasoil: ["combustible"],
      combustible: ["combustible"],
      "estacion de servicio": ["combustible"],
      luz: ["electricidad", "servicios"],
      electricidad: ["electricidad", "servicios"],
      edesur: ["electricidad"],
      edenor: ["electricidad"],
      gas: ["gas", "servicios"],
      agua: ["agua", "servicios"],
      internet: ["internet", "servicios"],
      cable: ["internet", "cable", "servicios"],
      telefono: ["telefono", "internet", "servicios"],
      celular: ["telefono", "celular", "servicios"],
      servicios: ["servicios"],
      impuestos: ["impuestos", "servicios"],
      expensas: ["expensas", "alquiler"],
      alquiler: ["alquiler"],
      renta: ["alquiler"],
      farmacia: ["farmacia", "salud"],
      remedios: ["farmacia", "salud"],
      medicamentos: ["farmacia", "salud"],
      salud: ["salud"],
      medico: ["salud", "medico"],
      "obra social": ["salud", "obra social"],
      prepaga: ["salud", "prepaga"],
      ropa: ["ropa"],
      zapatillas: ["ropa", "calzado"],
      indumentaria: ["ropa", "indumentaria"],
      recreacion: ["recreacion"],
      salida: ["recreacion", "salidas"],
      cine: ["recreacion", "cine"],
      bar: ["recreacion", "bar"],
      restaurante: ["recreacion", "restaurante", "comida"],
      cigarrillos: ["cigarrillos", "tabaco"],
      puchos: ["cigarrillos", "tabaco"],
      tabaco: ["tabaco", "cigarrillos"],
      transporte: ["transporte"],
      colectivo: ["transporte", "colectivo"],
      taxi: ["transporte", "taxi"],
      remis: ["transporte", "taxi"],
      uber: ["transporte"],
      sube: ["transporte", "sube"],
      educacion: ["educacion"],
      colegio: ["educacion", "colegio"],
      facultad: ["educacion", "facultad"],
      curso: ["educacion", "curso"],
      mascota: ["mascotas", "mascota"],
      veterinaria: ["mascotas", "veterinaria"],
      regalo: ["regalos", "regalo"],
      regalos: ["regalos", "regalo"],
      viaje: ["viajes", "viaje"],
      vacaciones: ["viajes", "vacaciones"],
      peluqueria: ["peluqueria", "cuidado personal"],
      barberia: ["peluqueria", "barberia"],
      "cuidado personal": ["cuidado personal"],
      compras: ["compras"],
      shopping: ["compras", "shopping"],
    },
    // ── Cuentas ────────────────────────────────────────────────────────────
    cuenta: {
      galicia: ["galicia", "banco galicia"],
      "banco galicia": ["banco galicia", "galicia"],
      truist: ["truist", "banco truist"],
      billetera: ["billetera"],
      efectivo: ["efectivo", "billetera", "caja"],
      cash: ["efectivo", "billetera"],
      caja: ["caja"],
      "caja de ahorro": ["caja de ahorro", "caja"],
      western: ["western union", "western"],
      "western union": ["western union", "western"],
      banco: ["banco"],
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
    for (const [ambito, terminos] of Object.entries(this.SISTEMA)) {
      for (const [termino, destinos] of Object.entries(terminos)) {
        for (const destino of destinos) {
          await queryRunner.query(
            `INSERT INTO "voz_alias"
               ("usuarioId", "ambito", "termino", "terminoNorm", "destinoValor",
                "destinoEtiqueta", "origen", "usos", "correcciones", "activo", "eliminado")
             VALUES (NULL, $1, $2, $3, $4, $4, 'sistema', 0, 0, true, false)
             ON CONFLICT DO NOTHING`,
            [ambito, termino, termino, destino]
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
