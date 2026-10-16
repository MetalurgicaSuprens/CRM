import { dataDoMomento, horaDoMomento, momentoEmBrasilia } from "dominio/datas";
import type { ConviteGerado, LoginNaGestao } from "../../../web/src/admin/tipos.ts";
import { LINHA_DE_COMANDO } from "../auditoria.ts";
import { bloquearChaves, criarLogin, criarLoginDeAdmin, desativarLogin, gerarConvite, verLogin, verLogins, type Contexto } from "./gestao.ts";

/*
 * As ações de admin pela linha de comando, no próprio servidor, por SSH (gestao.ts, as mesmas da
 * tela da administração). É por aqui que nasce o primeiro admin (docs/plano.md, "server/"); o resto
 * a tela faz.
 */

export function convidar(contexto: Contexto, novo: { nome: string; codigos: readonly string[] }): string {
  const convite = criarLogin(contexto, novo, LINHA_DE_COMANDO);
  const codigos = verLogin(contexto, convite.idDoLogin)?.codigos.map(({ codigo }) => codigo) ?? [];
  return `Login criado: ${convite.nome} (${convite.idDoLogin}), com os códigos ${codigos.join(", ")}.\n${textoDoConvite(convite, "o representante")}`;
}

/** O login de quem administra: entra só na administração, com a chave de acesso dele. */
export function criarAdmin(contexto: Contexto, { nome }: { nome: string }): string {
  const convite = criarLoginDeAdmin(contexto, { nome }, LINHA_DE_COMANDO);
  return `Login de admin criado: ${convite.nome} (${convite.idDoLogin}).\n${textoDoConvite(convite, "você")}`;
}

/** Para o aparelho novo ou perdido: o convite anterior que ainda não foi usado deixa de valer. */
export function novoConvite(contexto: Contexto, idDoLogin: string): string {
  return textoDoConvite(gerarConvite(contexto, idDoLogin, LINHA_DE_COMANDO), "o dono do login");
}

export function listar(contexto: Contexto): string {
  const logins = verLogins(contexto);
  if (logins.length === 0) return 'Nenhum login ainda. Para criar o seu, de admin: npm run admin -- criar-admin --nome "Seu nome"';
  return logins.map((login) => descreverLogin(contexto, login)).join("\n\n");
}

/** As chaves deixam de valer e as sessões terminam; o login continua, para receber um convite novo. */
export function revogar(contexto: Contexto, idDoLogin: string): string {
  const quantas = bloquearChaves(contexto, idDoLogin, LINHA_DE_COMANDO);
  const nome = verLogin(contexto, idDoLogin)?.nome ?? idDoLogin;
  return `${quantas} chave(s) de ${nome} bloqueada(s), e as sessões dele encerradas. Para um aparelho novo: npm run admin -- novo-convite --usuario ${idDoLogin}`;
}

/** O representante que sai: o login, as chaves, as sessões e os convites deixam de valer. */
export function desativar(contexto: Contexto, idDoLogin: string): string {
  desativarLogin(contexto, idDoLogin, LINHA_DE_COMANDO);
  return `Login ${verLogin(contexto, idDoLogin)?.nome ?? idDoLogin} desativado: as chaves, as sessões e os convites dele não valem mais.`;
}

function textoDoConvite({ nome, link, validoAte }: ConviteGerado, quemAbre: string): string {
  return [
    `Convite para ${nome}. Vale uma vez só, até ${formatarMomento(validoAte)} (Brasília):`,
    link,
    `Só ${quemAbre} deve abrir o link: quem abrir cria a chave de acesso deste login.`,
  ].join("\n");
}

function descreverLogin(contexto: Contexto, login: LoginNaGestao): string {
  const papel = login.papel === "admin" ? "admin" : `códigos ${login.codigos.map(({ codigo }) => codigo).join(", ")}`;
  const chaves = (verLogin(contexto, login.id)?.chaves ?? []).map(
    (chave) =>
      `  - ${chave.provedor}, criada em ${formatarMomento(chave.criadaEm)}` +
      (chave.ultimoUso ? `, último uso em ${formatarMomento(chave.ultimoUso)}` : "") +
      (chave.bloqueadaEm ? " (bloqueada)" : ""),
  );
  const situacao = login.situacao === "desativado" ? "desativado" : "ativo";
  return [`${login.nome} (${login.id}), ${situacao}, ${papel}`, ...(chaves.length > 0 ? chaves : ["  - nenhuma chave"])].join("\n");
}

/** "2026-10-17T18:42:00.000Z" → "17/10/2026 às 15:42", em Brasília. */
function formatarMomento(momentoIso: string): string {
  const momento = momentoEmBrasilia(new Date(momentoIso));
  const [ano, mes, dia] = dataDoMomento(momento).split("-");
  return `${dia}/${mes}/${ano} às ${horaDoMomento(momento)}`;
}
