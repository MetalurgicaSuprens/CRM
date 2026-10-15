import type { DatabaseSync, SQLOutputValue } from "node:sqlite";
import type { Sessao } from "../sessao.ts";
import { gerarToken, hashDoToken } from "./token.ts";
import { codigosDo } from "./usuarios.ts";

/*
 * A sessão aberta pela chave de acesso (docs/plano.md, "Sessão"): termina com 60 minutos sem uso
 * ou 12 horas depois de aberta, e a cada requisição confere que o usuário segue ativo e que a chave
 * não foi revogada. O banco guarda só o hash do token do cookie.
 */

export const LIMITE_SEM_USO_MS = 60 * 60_000;
export const DURACAO_MAXIMA_MS = 12 * 60 * 60_000;
/** O último uso é gravado no máximo uma vez por minuto: menos escrita, e a regra dos 60 minutos não muda. */
const INTERVALO_DO_ULTIMO_USO_MS = 60_000;

/** Por que a sessão terminou: a tela de entrada explica cada um. "revogada": usuário desativado ou chave revogada. */
export type MotivoDoFim = "saiu" | "inatividade" | "limite" | "revogada";

export type ConsultaDaSessao = { sessao: Sessao } | { sessao: null; motivo: MotivoDoFim | null };

type LinhaDaSessao = Record<string, SQLOutputValue>;

export function abrirSessao(banco: DatabaseSync, { usuario, chave }: { usuario: string; chave: string }, agora: Date): string {
  const token = gerarToken();
  banco
    .prepare("INSERT INTO sessoes (hash, usuario, chave, criada_em, ultimo_uso) VALUES (?, ?, ?, ?, ?)")
    .run(hashDoToken(token), usuario, chave, agora.toISOString(), agora.toISOString());
  return token;
}

/** A sessão do token, se ainda vale. A que venceu é encerrada aqui mesmo, com o motivo. */
export function usarSessao(banco: DatabaseSync, token: string, agora: Date): ConsultaDaSessao {
  const hash = hashDoToken(token);
  const linha = banco
    .prepare(
      `SELECT s.usuario, s.criada_em, s.ultimo_uso, s.encerrada_em, s.motivo, u.nome, u.ativo, c.revogada_em
         FROM sessoes s JOIN usuarios u ON u.id = s.usuario JOIN chaves c ON c.id = s.chave
        WHERE s.hash = ?`,
    )
    .get(hash);
  if (!linha) return { sessao: null, motivo: null };
  if (linha.encerrada_em !== null) return { sessao: null, motivo: linha.motivo as MotivoDoFim };
  const fim = motivoDoFim(linha, agora);
  if (fim) {
    encerrar(banco, hash, fim, agora);
    return { sessao: null, motivo: fim };
  }
  if (agora.getTime() - Date.parse(String(linha.ultimo_uso)) >= INTERVALO_DO_ULTIMO_USO_MS) {
    banco.prepare("UPDATE sessoes SET ultimo_uso = ? WHERE hash = ?").run(agora.toISOString(), hash);
  }
  const usuario = String(linha.usuario);
  return { sessao: { idDoUsuario: usuario, nome: String(linha.nome), codigos: codigosDo(banco, usuario) } };
}

/** Encerra a sessão do token, se ela estava aberta; devolve o usuário dela, para a auditoria. */
export function encerrarSessao(banco: DatabaseSync, token: string, motivo: MotivoDoFim, agora: Date): string | null {
  const hash = hashDoToken(token);
  const linha = banco.prepare("SELECT usuario FROM sessoes WHERE hash = ? AND encerrada_em IS NULL").get(hash);
  if (!linha) return null;
  encerrar(banco, hash, motivo, agora);
  return String(linha.usuario);
}

export function encerrarSessoesDo(banco: DatabaseSync, usuario: string, motivo: MotivoDoFim, agora: Date): void {
  banco.prepare("UPDATE sessoes SET encerrada_em = ?, motivo = ? WHERE usuario = ? AND encerrada_em IS NULL").run(agora.toISOString(), motivo, usuario);
}

function motivoDoFim(linha: LinhaDaSessao, agora: Date): MotivoDoFim | null {
  if (linha.ativo !== 1 || linha.revogada_em !== null) return "revogada";
  if (agora.getTime() - Date.parse(String(linha.criada_em)) >= DURACAO_MAXIMA_MS) return "limite";
  if (agora.getTime() - Date.parse(String(linha.ultimo_uso)) >= LIMITE_SEM_USO_MS) return "inatividade";
  return null;
}

function encerrar(banco: DatabaseSync, hash: string, motivo: MotivoDoFim, agora: Date): void {
  banco.prepare("UPDATE sessoes SET encerrada_em = ?, motivo = ? WHERE hash = ?").run(agora.toISOString(), motivo, hash);
}
