import type { DatabaseSync } from "node:sqlite";
import { emTransacao } from "../bancoDoApp.ts";
import { gerarToken, hashDoToken } from "./token.ts";

/*
 * O convite que o admin manda ao representante (docs/plano.md, "Convite"): uso único, válido por
 * 48 horas. Ele só é usado quando a chave é criada, porque a prévia de link do WhatsApp abre o
 * endereço sozinha. O token vai depois do "#" do link e o banco guarda só o hash.
 */

export const VALIDADE_DO_CONVITE_MS = 48 * 60 * 60 * 1_000;

export type ConsultaDoConvite =
  | { estado: "valido"; usuario: string; nome: string; validoAte: string }
  /** "trocado": o admin mandou um convite mais novo, e só o último link vale. */
  | { estado: "expirado" | "usado" | "trocado" | "invalido" };

export function criarConvite(banco: DatabaseSync, { usuario, criadoPor }: { usuario: string; criadoPor: string }, agora: Date): { token: string; validoAte: string } {
  const token = gerarToken();
  const validoAte = new Date(agora.getTime() + VALIDADE_DO_CONVITE_MS).toISOString();
  emTransacao(banco, () => {
    trocarConvitesDo(banco, usuario, agora);
    banco
      .prepare("INSERT INTO convites (hash, usuario, criado_por, criado_em, expira_em) VALUES (?, ?, ?, ?, ?)")
      .run(hashDoToken(token), usuario, criadoPor, agora.toISOString(), validoAte);
  });
  return { token, validoAte };
}

export function consultarConvite(banco: DatabaseSync, token: string, agora: Date): ConsultaDoConvite {
  const linha = banco
    .prepare(
      `SELECT c.usuario, c.expira_em, c.usado_em, c.trocado_em, u.nome, u.ativo
         FROM convites c JOIN usuarios u ON u.id = c.usuario WHERE c.hash = ?`,
    )
    .get(hashDoToken(token));
  if (!linha || linha.ativo !== 1) return { estado: "invalido" };
  if (linha.usado_em !== null) return { estado: "usado" };
  if (linha.trocado_em !== null) return { estado: "trocado" };
  if (String(linha.expira_em) <= agora.toISOString()) return { estado: "expirado" };
  return { estado: "valido", usuario: String(linha.usuario), nome: String(linha.nome), validoAte: String(linha.expira_em) };
}

/**
 * Usa o convite, se ele ainda vale. Chame na mesma transação que grava a chave: de dois pedidos
 * ao mesmo tempo com o mesmo convite, só um consegue.
 */
export function usarConvite(banco: DatabaseSync, token: string, agora: Date): boolean {
  const momento = agora.toISOString();
  return (
    banco
      .prepare("UPDATE convites SET usado_em = ? WHERE hash = ? AND usado_em IS NULL AND trocado_em IS NULL AND expira_em > ?")
      .run(momento, hashDoToken(token), momento).changes > 0
  );
}

/** Os convites ainda não usados do usuário deixam de valer. */
export function trocarConvitesDo(banco: DatabaseSync, usuario: string, agora: Date): void {
  banco.prepare("UPDATE convites SET trocado_em = ? WHERE usuario = ? AND usado_em IS NULL AND trocado_em IS NULL").run(agora.toISOString(), usuario);
}
