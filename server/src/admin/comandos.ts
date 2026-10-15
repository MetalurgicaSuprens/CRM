import type { DatabaseSync } from "node:sqlite";
import { dataDoMomento, horaDoMomento, momentoEmBrasilia } from "dominio/datas";
import { auditar, LINHA_DE_COMANDO } from "../auditoria.ts";
import { emTransacao } from "../bancoDoApp.ts";
import { resumoDasChavesDo, revogarChavesDo } from "../login/chaves.ts";
import { criarConvite, trocarConvitesDo } from "../login/convites.ts";
import { encerrarSessoesDo } from "../login/sessoes.ts";
import { buscarUsuario, criarUsuario, desativarUsuario, listarUsuarios, type Usuario } from "../login/usuarios.ts";

/*
 * As ações de admin pela linha de comando, no próprio servidor, por SSH. É assim que o primeiro
 * admin trabalha (docs/plano.md, "server/"); a tela de Admin, só na rede interna, vem depois.
 * Toda ação vai para a auditoria.
 */

export type Contexto = {
  banco: DatabaseSync;
  /** O endereço do CRM, para montar o link do convite. */
  origem: string;
  /** Os códigos da lista de autorizados da foto, lidos só quando a ação liga códigos. */
  autorizados: () => ReadonlySet<string>;
  agora: Date;
};

export class ComandoRecusado extends Error {}

export function convidar(contexto: Contexto, { nome, codigos }: { nome: string; codigos: readonly string[] }): string {
  const { banco, agora } = contexto;
  const usuario = criarUsuario(banco, { nome, codigos, autorizados: contexto.autorizados(), ligadoPor: LINHA_DE_COMANDO }, agora);
  auditar(banco, { usuario: LINHA_DE_COMANDO, evento: "usuario_criado", alvo: usuario.id });
  return `Login criado: ${usuario.nome} (${usuario.id}), com os códigos ${usuario.codigos.join(", ")}.\n${textoDoConvite(contexto, usuario)}`;
}

/** Para o aparelho novo ou perdido: o convite anterior que ainda não foi usado deixa de valer. */
export function novoConvite(contexto: Contexto, idDoUsuario: string): string {
  const usuario = usuarioDo(contexto, idDoUsuario);
  if (!usuario.ativo) throw new ComandoRecusado(`O login ${usuario.nome} está desativado.`);
  return textoDoConvite(contexto, usuario);
}

export function listar({ banco }: Contexto): string {
  const usuarios = listarUsuarios(banco);
  if (usuarios.length === 0) return 'Nenhum login ainda. Para criar: npm run admin -- convidar --nome "Nome" --codigos 1401,1402';
  return usuarios.map((usuario) => descreverUsuario(banco, usuario)).join("\n\n");
}

/** As chaves deixam de valer e as sessões terminam; o login continua, para receber um convite novo. */
export function revogar(contexto: Contexto, idDoUsuario: string): string {
  const { banco, agora } = contexto;
  const usuario = usuarioDo(contexto, idDoUsuario);
  const quantas = emTransacao(banco, () => {
    encerrarSessoesDo(banco, usuario.id, "revogada", agora);
    return revogarChavesDo(banco, usuario.id, agora);
  });
  auditar(banco, { usuario: LINHA_DE_COMANDO, evento: "chaves_revogadas", alvo: usuario.id, resultado: `${quantas} chave(s)` });
  return `${quantas} chave(s) de ${usuario.nome} revogada(s), e as sessões dele encerradas. Para um aparelho novo: npm run admin -- novo-convite --usuario ${usuario.id}`;
}

/** O representante que sai: o login, as chaves, as sessões e os convites deixam de valer. */
export function desativar(contexto: Contexto, idDoUsuario: string): string {
  const { banco, agora } = contexto;
  const usuario = usuarioDo(contexto, idDoUsuario);
  emTransacao(banco, () => {
    desativarUsuario(banco, usuario.id);
    encerrarSessoesDo(banco, usuario.id, "revogada", agora);
    revogarChavesDo(banco, usuario.id, agora);
    trocarConvitesDo(banco, usuario.id, agora);
  });
  auditar(banco, { usuario: LINHA_DE_COMANDO, evento: "usuario_desativado", alvo: usuario.id });
  return `Login ${usuario.nome} desativado: as chaves, as sessões e os convites dele não valem mais.`;
}

function textoDoConvite({ banco, origem, agora }: Contexto, usuario: Usuario): string {
  const { token, validoAte } = criarConvite(banco, { usuario: usuario.id, criadoPor: LINHA_DE_COMANDO }, agora);
  auditar(banco, { usuario: LINHA_DE_COMANDO, evento: "convite_criado", alvo: usuario.id });
  return [
    `Convite para ${usuario.nome}. Vale uma vez só, até ${formatarMomento(validoAte)} (Brasília):`,
    `${origem}/convite#${token}`,
    "Mande só para o representante: quem abrir o link cria a chave de acesso deste login.",
  ].join("\n");
}

function descreverUsuario(banco: DatabaseSync, usuario: Usuario): string {
  const chaves = resumoDasChavesDo(banco, usuario.id).map(
    (chave) =>
      `  - ${chave.provedor}, criada em ${formatarMomento(chave.criadaEm)}` +
      (chave.ultimoUso ? `, último uso em ${formatarMomento(chave.ultimoUso)}` : "") +
      (chave.revogada ? " (revogada)" : ""),
  );
  const situacao = usuario.ativo ? "ativo" : "desativado";
  return [`${usuario.nome} (${usuario.id}), ${situacao}, códigos ${usuario.codigos.join(", ")}`, ...(chaves.length > 0 ? chaves : ["  - nenhuma chave"])].join("\n");
}

function usuarioDo({ banco }: Contexto, id: string): Usuario {
  const usuario = buscarUsuario(banco, id);
  if (!usuario) throw new ComandoRecusado(`Nenhum login com o id ${id}. Veja os ids com: npm run admin -- usuarios`);
  return usuario;
}

/** "2026-10-17T18:42:00.000Z" → "17/10/2026 às 15:42", em Brasília. */
function formatarMomento(momentoIso: string): string {
  const momento = momentoEmBrasilia(new Date(momentoIso));
  const [ano, mes, dia] = dataDoMomento(momento).split("-");
  return `${dia}/${mes}/${ano} às ${horaDoMomento(momento)}`;
}
