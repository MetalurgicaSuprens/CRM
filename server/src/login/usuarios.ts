import { randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { emTransacao } from "../bancoDoApp.ts";

/*
 * Quem entra no sistema. O representante entra no CRM: um login por representação, com um ou mais
 * códigos de representante do ERP, e as telas somam todos (decisão do Lucas em 2026-10-13). Um código
 * fica em um login ativo só. O admin entra só na administração e não tem código.
 */

export type Papel = "representante" | "admin";

export type Usuario = {
  id: string;
  nome: string;
  papel: Papel;
  /** O identificador da pessoa na chave de acesso: aleatório, sem nada do ERP (plano.md, "Chave de acesso"). */
  idWebauthn: string;
  ativo: boolean;
  codigos: string[];
  criadoEm: string;
};

export type NovoRepresentante = {
  nome: string;
  codigos: readonly string[];
  /** Os códigos da lista de autorizados da foto (CLAUDE.md, regra 4): fora dela, nenhum código entra. */
  autorizados: ReadonlySet<string>;
  ligadoPor: string;
};

export class UsuarioRecusado extends Error {}

const FORMATO_DO_CODIGO = /^\d{1,9}$/;

/** O login de uma representação, com os códigos dela. */
export function criarUsuario(banco: DatabaseSync, novo: NovoRepresentante, agora: Date): Usuario {
  const codigos = conferirCodigos({ codigos: novo.codigos, autorizados: novo.autorizados });
  const usuario = novoUsuario(novo.nome, "representante", codigos, agora);
  emTransacao(banco, () => {
    inserir(banco, usuario);
    ligarCodigos(banco, { usuario: usuario.id, codigos, ligadoPor: novo.ligadoPor }, agora);
  });
  return usuario;
}

/** O login de quem administra o sistema: entra só na administração. */
export function criarAdmin(banco: DatabaseSync, { nome }: { nome: string }, agora: Date): Usuario {
  const usuario = novoUsuario(nome, "admin", [], agora);
  inserir(banco, usuario);
  return usuario;
}

/** Troca os códigos do login pelos novos, com as mesmas regras da criação. */
export function trocarCodigos(banco: DatabaseSync, troca: { usuario: string; codigos: readonly string[]; autorizados: ReadonlySet<string>; ligadoPor: string }, agora: Date): string[] {
  const codigos = conferirCodigos({ codigos: troca.codigos, autorizados: troca.autorizados });
  emTransacao(banco, () => {
    banco.prepare("DELETE FROM usuario_codigos WHERE usuario = ?").run(troca.usuario);
    ligarCodigos(banco, { usuario: troca.usuario, codigos, ligadoPor: troca.ligadoPor }, agora);
  });
  return codigos;
}

export function buscarUsuario(banco: DatabaseSync, id: string): Usuario | null {
  const linha = banco.prepare("SELECT id, nome, papel, id_webauthn, ativo, criado_em FROM usuarios WHERE id = ?").get(id);
  if (!linha) return null;
  return {
    id: String(linha.id),
    nome: String(linha.nome),
    papel: linha.papel as Papel,
    idWebauthn: String(linha.id_webauthn),
    ativo: linha.ativo === 1,
    codigos: codigosDo(banco, id),
    criadoEm: String(linha.criado_em),
  };
}

export function codigosDo(banco: DatabaseSync, usuario: string): string[] {
  return banco
    .prepare("SELECT codigo FROM usuario_codigos WHERE usuario = ? ORDER BY codigo")
    .all(usuario)
    .map((linha) => String(linha.codigo));
}

export function listarUsuarios(banco: DatabaseSync): Usuario[] {
  return banco
    .prepare("SELECT id FROM usuarios ORDER BY nome, criado_em")
    .all()
    .flatMap((linha) => buscarUsuario(banco, String(linha.id)) ?? []);
}

/** Código → os logins ativos que o usam, pelo nome. */
export function loginsAtivosPorCodigo(banco: DatabaseSync): Map<string, { id: string; nome: string }[]> {
  const porCodigo = new Map<string, { id: string; nome: string }[]>();
  const linhas = banco
    .prepare("SELECT uc.codigo, u.id, u.nome FROM usuario_codigos uc JOIN usuarios u ON u.id = uc.usuario WHERE u.ativo = 1 ORDER BY u.nome, u.criado_em")
    .all();
  for (const linha of linhas) {
    const codigo = String(linha.codigo);
    porCodigo.set(codigo, [...(porCodigo.get(codigo) ?? []), { id: String(linha.id), nome: String(linha.nome) }]);
  }
  return porCodigo;
}

export function desativarUsuario(banco: DatabaseSync, id: string): boolean {
  return banco.prepare("UPDATE usuarios SET ativo = 0 WHERE id = ? AND ativo = 1").run(id).changes > 0;
}

function novoUsuario(nome: string, papel: Papel, codigos: string[], agora: Date): Usuario {
  const limpo = nome.trim();
  if (limpo === "") throw new UsuarioRecusado("Falta o nome.");
  return {
    id: randomBytes(8).toString("hex"),
    nome: limpo,
    papel,
    idWebauthn: randomBytes(32).toString("base64url"),
    ativo: true,
    codigos,
    criadoEm: agora.toISOString(),
  };
}

function inserir(banco: DatabaseSync, usuario: Usuario): void {
  banco
    .prepare("INSERT INTO usuarios (id, nome, papel, id_webauthn, ativo, criado_em) VALUES (?, ?, ?, ?, 1, ?)")
    .run(usuario.id, usuario.nome, usuario.papel, usuario.idWebauthn, usuario.criadoEm);
}

function ligarCodigos(banco: DatabaseSync, { usuario, codigos, ligadoPor }: { usuario: string; codigos: readonly string[]; ligadoPor: string }, agora: Date): void {
  const ligar = banco.prepare("INSERT INTO usuario_codigos (usuario, codigo, ligado_em, ligado_por) VALUES (?, ?, ?, ?)");
  for (const codigo of codigos) ligar.run(usuario, codigo, agora.toISOString(), ligadoPor);
}

/**
 * Os códigos sem repetição e em ordem, se todos passam: formato e lista de autorizados. O mesmo
 * código pode estar em vários logins: um por pessoa, como os vendedores de um escritório de
 * representação (decisão do Lucas em 2026-11-18, docs/plano.md, "Convite").
 */
function conferirCodigos({ codigos, autorizados }: { codigos: readonly string[]; autorizados: ReadonlySet<string> }): string[] {
  const unicos = [...new Set(codigos)].sort();
  if (unicos.length === 0) throw new UsuarioRecusado("Falta pelo menos um código de representante.");
  const foraDoFormato = unicos.filter((codigo) => !FORMATO_DO_CODIGO.test(codigo));
  if (foraDoFormato.length > 0) throw new UsuarioRecusado(`Código fora do formato: ${foraDoFormato.join(", ")}.`);
  const naoAutorizados = unicos.filter((codigo) => !autorizados.has(codigo));
  if (naoAutorizados.length > 0) throw new UsuarioRecusado(`Código fora da lista de autorizados da foto: ${naoAutorizados.join(", ")}.`);
  return unicos;
}
