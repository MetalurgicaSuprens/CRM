import { randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { emTransacao } from "../bancoDoApp.ts";

/*
 * Quem entra no CRM: um login por representação, com um ou mais códigos de representante do ERP, e
 * as telas somam todos (decisão do Lucas em 2026-10-13). Um código fica em um login ativo só.
 */

export type Usuario = {
  id: string;
  nome: string;
  /** O identificador da pessoa na chave de acesso: aleatório, sem nada do ERP (plano.md, "Chave de acesso"). */
  idWebauthn: string;
  ativo: boolean;
  codigos: string[];
};

export type NovoUsuario = {
  nome: string;
  codigos: readonly string[];
  /** Os códigos da lista de autorizados da foto (CLAUDE.md, regra 4): fora dela, nenhum código entra. */
  autorizados: ReadonlySet<string>;
  ligadoPor: string;
};

export class UsuarioRecusado extends Error {}

const FORMATO_DO_CODIGO = /^\d{1,9}$/;

export function criarUsuario(banco: DatabaseSync, novo: NovoUsuario, agora: Date): Usuario {
  const nome = novo.nome.trim();
  const codigos = [...new Set(novo.codigos)].sort();
  conferirNovoUsuario(banco, { ...novo, nome, codigos });
  const usuario: Usuario = { id: randomBytes(8).toString("hex"), nome, idWebauthn: randomBytes(32).toString("base64url"), ativo: true, codigos };
  emTransacao(banco, () => {
    banco
      .prepare("INSERT INTO usuarios (id, nome, id_webauthn, ativo, criado_em) VALUES (?, ?, ?, 1, ?)")
      .run(usuario.id, usuario.nome, usuario.idWebauthn, agora.toISOString());
    const ligar = banco.prepare("INSERT INTO usuario_codigos (usuario, codigo, ligado_em, ligado_por) VALUES (?, ?, ?, ?)");
    for (const codigo of codigos) ligar.run(usuario.id, codigo, agora.toISOString(), novo.ligadoPor);
  });
  return usuario;
}

export function buscarUsuario(banco: DatabaseSync, id: string): Usuario | null {
  const linha = banco.prepare("SELECT id, nome, id_webauthn, ativo FROM usuarios WHERE id = ?").get(id);
  if (!linha) return null;
  return { id: String(linha.id), nome: String(linha.nome), idWebauthn: String(linha.id_webauthn), ativo: linha.ativo === 1, codigos: codigosDo(banco, id) };
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

export function desativarUsuario(banco: DatabaseSync, id: string): boolean {
  return banco.prepare("UPDATE usuarios SET ativo = 0 WHERE id = ? AND ativo = 1").run(id).changes > 0;
}

function conferirNovoUsuario(banco: DatabaseSync, { nome, codigos, autorizados }: NovoUsuario): void {
  if (nome === "") throw new UsuarioRecusado("Falta o nome.");
  if (codigos.length === 0) throw new UsuarioRecusado("Falta pelo menos um código de representante.");
  const foraDoFormato = codigos.filter((codigo) => !FORMATO_DO_CODIGO.test(codigo));
  if (foraDoFormato.length > 0) throw new UsuarioRecusado(`Código fora do formato: ${foraDoFormato.join(", ")}.`);
  const naoAutorizados = codigos.filter((codigo) => !autorizados.has(codigo));
  if (naoAutorizados.length > 0) throw new UsuarioRecusado(`Código fora da lista de autorizados da foto: ${naoAutorizados.join(", ")}.`);
  const emUso = codigosEmLoginAtivo(banco, codigos);
  if (emUso.length > 0) throw new UsuarioRecusado(`Código já ligado a outro login ativo: ${emUso.join(", ")}.`);
}

function codigosEmLoginAtivo(banco: DatabaseSync, codigos: readonly string[]): string[] {
  return banco
    .prepare(
      `SELECT DISTINCT uc.codigo FROM usuario_codigos uc JOIN usuarios u ON u.id = uc.usuario
        WHERE u.ativo = 1 AND uc.codigo IN (${codigos.map(() => "?").join(", ")}) ORDER BY uc.codigo`,
    )
    .all(...codigos)
    .map((linha) => String(linha.codigo));
}
