import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Login con biometría (WebAuthn / passkeys), 2026-09-15.
 *
 * Crea la tabla `webauthn_credential` (una fila por dispositivo habilitado).
 * **No requiere backfill**: la credencial la genera el dispositivo del usuario,
 * no se puede crear desde el servidor ⇒ la tabla arranca vacía y la feature es
 * opt-in (los usuarios siguen entrando con email + contraseña).
 */
export class AddWebauthnCredential1790000000000 implements MigrationInterface {
  name = "AddWebauthnCredential1790000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "webauthn_credential" (
        "id" SERIAL NOT NULL,
        "credentialId" character varying NOT NULL,
        "publicKey" text NOT NULL,
        "counter" integer NOT NULL DEFAULT 0,
        "transports" character varying(64),
        "deviceType" character varying(32),
        "backedUp" boolean NOT NULL DEFAULT false,
        "nombre" character varying(80),
        "creadoEn" TIMESTAMP NOT NULL DEFAULT now(),
        "ultimoUsoEn" TIMESTAMP,
        "eliminado" boolean NOT NULL DEFAULT false,
        "usuarioId" integer NOT NULL,
        CONSTRAINT "PK_webauthn_credential" PRIMARY KEY ("id")
      )`
    );

    // Al borrar el usuario se van sus credenciales (no queda un acceso huérfano).
    await queryRunner.query(
      `ALTER TABLE "webauthn_credential"
         ADD CONSTRAINT "FK_webauthn_credential_usuario"
         FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id")
         ON DELETE CASCADE ON UPDATE NO ACTION`
    );

    // Único GLOBAL: el login busca la credencial por este id (passkey sin usuario).
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_webauthn_credential_credentialId"
         ON "webauthn_credential" ("credentialId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_webauthn_credential_usuario"
         ON "webauthn_credential" ("usuarioId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Sin backfill: perder las credenciales solo obliga a volver a activarlas
    // (la contraseña sigue funcionando como siempre).
    await queryRunner.query(`DROP TABLE "webauthn_credential"`);
  }
}
