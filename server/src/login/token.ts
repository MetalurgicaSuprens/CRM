import { createHash, randomBytes } from "node:crypto";

/*
 * O token do convite e o da sessão: 256 bits aleatórios em base64url. O banco guarda só o hash,
 * para um vazamento do app.db não abrir nenhuma sessão nem convite.
 */

/** 32 bytes em base64url, sem preenchimento: 43 caracteres. */
export const FORMATO_DO_TOKEN = "^[A-Za-z0-9_-]{43}$";

export function gerarToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
