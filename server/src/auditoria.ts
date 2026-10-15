import type { DatabaseSync } from "node:sqlite";

/*
 * O registro dos acessos (docs/plano.md, "Auditoria"), no app.db. O alvo é sempre um id (do
 * usuário, da chave ou o código opaco do cliente), nunca o nome nem o corpo da requisição.
 */

export type Evento =
  | "usuario_criado"
  | "convite_criado"
  | "chave_criada"
  | "chave_recusada"
  | "entrada"
  | "entrada_recusada"
  | "saida"
  | "chaves_revogadas"
  | "usuario_desativado"
  | "ficha_consultada";

/** Quem fez: o id do usuário ou, nas ações de admin pela linha de comando, esta marca. */
export const LINHA_DE_COMANDO = "linha-de-comando";

export type Registro = { usuario: string | null; evento: Evento; alvo?: string | null; resultado?: string };

export function auditar(banco: DatabaseSync, { usuario, evento, alvo = null, resultado = "ok" }: Registro): void {
  banco
    .prepare("INSERT INTO auditoria (momento, usuario, evento, alvo, resultado) VALUES (?, ?, ?, ?, ?)")
    .run(new Date().toISOString(), usuario, evento, alvo, resultado);
}
