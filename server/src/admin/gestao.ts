import type { DatabaseSync } from "node:sqlite";
import type {
  ConviteGerado,
  DetalheDoLogin,
  EventoDoRegistro,
  LoginNaGestao,
  PaginaDoRegistro,
  RepresentanteAutorizado,
  SituacaoDoLogin,
} from "../../../web/src/admin/tipos.ts";
import { auditar, LINHA_DE_COMANDO } from "../auditoria.ts";
import { emTransacao } from "../bancoDoApp.ts";
import { FotoIndisponivel } from "../foto/fotoAtual.ts";
import { buscarChave, resumoDasChavesDo, revogarChave, revogarChavesDo } from "../login/chaves.ts";
import { convitesDo, criarConvite, trocarConvitesDo, type ConviteDoLogin } from "../login/convites.ts";
import { contarSessoesAbertas, encerrarSessoesDaChave, encerrarSessoesDo, sessoesDo } from "../login/sessoes.ts";
import {
  buscarUsuario,
  criarAdmin,
  criarUsuario,
  desativarUsuario,
  listarUsuarios,
  loginsAtivosPorCodigo,
  trocarCodigos,
  type Usuario,
} from "../login/usuarios.ts";

/*
 * O que a administração faz e mostra, pela tela (rotasDoAdmin.ts) ou pela linha de comando
 * (comandos.ts): criar logins e convites, trocar os códigos, bloquear chaves, encerrar sessões,
 * desativar logins, e a situação de cada um. Toda ação vai para a auditoria, com quem fez.
 */

export type Contexto = {
  banco: DatabaseSync;
  agora: Date;
  /** A foto mais nova; lança FotoIndisponivel se ainda não há nenhuma. */
  foto: () => DatabaseSync;
  /** Os endereços do CRM e da administração: o convite leva ao site do papel do login. */
  origens: { crm: string; admin: string };
};

/** Quem faz a ação: o id do admin que está na tela, ou LINHA_DE_COMANDO. */
export type Ator = string;

/** A ação não pode ser feita; a mensagem diz por quê, para a tela mostrar. */
export class AcaoRecusada extends Error {}
export class LoginNaoEncontrado extends AcaoRecusada {}

const EVENTOS_POR_PAGINA = 100;
const SESSOES_NO_DETALHE = 20;

export function criarLogin(contexto: Contexto, { nome, codigos }: { nome: string; codigos: readonly string[] }, ator: Ator): ConviteGerado {
  const usuario = criarUsuario(contexto.banco, { nome, codigos, autorizados: autorizadosDaFoto(contexto), ligadoPor: ator }, contexto.agora);
  auditar(contexto.banco, { usuario: ator, evento: "usuario_criado", alvo: usuario.id });
  return convidar(contexto, usuario, ator);
}

/** O login de admin entra só na administração. Pela linha de comando, no servidor: a tela não cria admin. */
export function criarLoginDeAdmin(contexto: Contexto, { nome }: { nome: string }, ator: Ator): ConviteGerado {
  const usuario = criarAdmin(contexto.banco, { nome }, contexto.agora);
  auditar(contexto.banco, { usuario: ator, evento: "usuario_criado", alvo: usuario.id, resultado: "admin" });
  return convidar(contexto, usuario, ator);
}

/** Para o primeiro acesso que não aconteceu ou para um aparelho novo: o convite anterior deixa de valer. */
export function gerarConvite(contexto: Contexto, idDoLogin: string, ator: Ator): ConviteGerado {
  return convidar(contexto, loginAtivo(contexto, idDoLogin), ator);
}

export function trocarCodigosDoLogin(contexto: Contexto, idDoLogin: string, codigos: readonly string[], ator: Ator): string[] {
  const usuario = loginAtivo(contexto, idDoLogin);
  if (usuario.papel !== "representante") throw new AcaoRecusada("O login de admin não tem códigos de representante.");
  const novos = trocarCodigos(contexto.banco, { usuario: usuario.id, codigos, autorizados: autorizadosDaFoto(contexto), ligadoPor: ator }, contexto.agora);
  auditar(contexto.banco, { usuario: ator, evento: "codigos_trocados", alvo: usuario.id, resultado: novos.join(", ") });
  return novos;
}

/** Todas as chaves do login deixam de valer, e as sessões terminam; o login continua, para um convite novo. */
export function bloquearChaves(contexto: Contexto, idDoLogin: string, ator: Ator): number {
  const { banco, agora } = contexto;
  const usuario = loginDe(contexto, idDoLogin);
  protegerOProprioLogin(usuario, ator, "bloquear as próprias chaves");
  const quantas = emTransacao(banco, () => {
    encerrarSessoesDo(banco, usuario.id, "revogada", agora);
    return revogarChavesDo(banco, usuario.id, agora);
  });
  auditar(banco, { usuario: ator, evento: "chaves_revogadas", alvo: usuario.id, resultado: `${quantas} chave(s)` });
  return quantas;
}

/** Uma chave só, como a do aparelho perdido; as outras do login continuam valendo. */
export function bloquearChave(contexto: Contexto, idDaChave: string, ator: Ator): void {
  const { banco, agora } = contexto;
  const chave = buscarChave(banco, idDaChave);
  if (!chave || chave.revogada) throw new AcaoRecusada("Esta chave não existe ou já está bloqueada.");
  protegerOProprioLogin(loginDe(contexto, chave.usuario), ator, "bloquear a própria chave");
  emTransacao(banco, () => {
    revogarChave(banco, chave.id, agora);
    encerrarSessoesDaChave(banco, chave.id, "revogada", agora);
  });
  auditar(banco, { usuario: ator, evento: "chave_revogada", alvo: chave.id });
}

/** Tira o login de todos os aparelhos agora; as chaves continuam valendo para entrar de novo. */
export function encerrarSessoes(contexto: Contexto, idDoLogin: string, ator: Ator): number {
  const usuario = loginDe(contexto, idDoLogin);
  protegerOProprioLogin(usuario, ator, "encerrar as próprias sessões (para sair, use Sair)");
  const quantas = encerrarSessoesDo(contexto.banco, usuario.id, "encerrada", contexto.agora);
  auditar(contexto.banco, { usuario: ator, evento: "sessoes_encerradas", alvo: usuario.id, resultado: `${quantas} sessão(ões)` });
  return quantas;
}

/** Para quem saiu da representação: o login, as chaves, as sessões e os convites deixam de valer. */
export function desativarLogin(contexto: Contexto, idDoLogin: string, ator: Ator): void {
  const { banco, agora } = contexto;
  const usuario = loginDe(contexto, idDoLogin);
  protegerOProprioLogin(usuario, ator, "desativar o próprio login");
  if (!usuario.ativo) throw new AcaoRecusada(`O login ${usuario.nome} já está desativado.`);
  emTransacao(banco, () => {
    desativarUsuario(banco, usuario.id);
    encerrarSessoesDo(banco, usuario.id, "revogada", agora);
    revogarChavesDo(banco, usuario.id, agora);
    trocarConvitesDo(banco, usuario.id, agora);
  });
  auditar(banco, { usuario: ator, evento: "usuario_desativado", alvo: usuario.id });
}

export function verLogins(contexto: Contexto): LoginNaGestao[] {
  const nomes = nomesDosRepresentantes(contexto);
  return listarUsuarios(contexto.banco).map((usuario) => resumoDoLogin(contexto, usuario, nomes));
}

export function verLogin(contexto: Contexto, id: string): DetalheDoLogin | null {
  const { banco, agora } = contexto;
  const usuario = buscarUsuario(banco, id);
  if (!usuario) return null;
  const chaves = resumoDasChavesDo(banco, id);
  const provedorDa = new Map(chaves.map((chave) => [chave.id, chave.provedor]));
  return {
    ...resumoDoLogin(contexto, usuario, nomesDosRepresentantes(contexto)),
    chaves: chaves.map(({ revogadaEm, ...chave }) => ({ ...chave, bloqueadaEm: revogadaEm })).reverse(),
    convites: convitesDo(banco, id, agora),
    sessoes: sessoesDo(banco, id, agora, SESSOES_NO_DETALHE).map(({ chave, ...sessao }) => ({ ...sessao, provedor: provedorDa.get(chave) ?? "Chave de acesso" })),
  };
}

/** A lista de autorizados da foto, com o login ativo que já usa cada código. */
export function verRepresentantes(contexto: Contexto): RepresentanteAutorizado[] {
  const ligados = loginsAtivosPorCodigo(contexto.banco);
  return [...nomesDosRepresentantes(contexto)].map(([codigo, nome]) => ({ codigo, nome, login: ligados.get(codigo) ?? null }));
}

/** O registro de acessos, do mais novo ao mais velho, de 100 em 100; com o login, só o que é dele ou foi feito nele. */
export function verRegistro(contexto: Contexto, { antesDe = null, login = null }: { antesDe?: number | null; login?: string | null }): PaginaDoRegistro {
  const linhas = contexto.banco
    .prepare(
      `SELECT id, momento, usuario, evento, alvo, resultado FROM auditoria
        WHERE (?1 IS NULL OR id < ?1)
          AND (?2 IS NULL OR usuario = ?2 OR alvo = ?2 OR alvo IN (SELECT id FROM chaves WHERE usuario = ?2))
        ORDER BY id DESC LIMIT ?3`,
    )
    .all(antesDe, login, EVENTOS_POR_PAGINA + 1);
  const pagina = linhas.slice(0, EVENTOS_POR_PAGINA);
  const descrever = descritorDoRegistro(contexto, pagina.flatMap((linha) => (linha.evento === "ficha_consultada" && linha.alvo !== null ? [String(linha.alvo)] : [])));
  return {
    eventos: pagina.map((linha) =>
      descrever({ id: Number(linha.id), momento: String(linha.momento), usuario: textoOuNulo(linha.usuario), evento: String(linha.evento), alvo: textoOuNulo(linha.alvo), resultado: String(linha.resultado) }),
    ),
    temMais: linhas.length > EVENTOS_POR_PAGINA,
  };
}

type LinhaDoRegistro = { id: number; momento: string; usuario: string | null; evento: string; alvo: string | null; resultado: string };

/** Troca os ids do registro por nomes: o login, a chave pelo provedor e o dono, o cliente da ficha. */
function descritorDoRegistro({ banco, foto }: Contexto, clientesDasFichas: readonly string[]): (linha: LinhaDoRegistro) => EventoDoRegistro {
  const logins = new Map(listarUsuarios(banco).map((usuario) => [usuario.id, usuario.nome]));
  const chaves = new Map(
    banco
      .prepare("SELECT id, usuario, provedor FROM chaves")
      .all()
      .map((linha) => [String(linha.id), `${String(linha.provedor)} de ${logins.get(String(linha.usuario)) ?? "login apagado"}`]),
  );
  const clientes = nomesDosClientes(foto, clientesDasFichas);
  const quem = (usuario: string | null) => (usuario === LINHA_DE_COMANDO ? "Linha de comando" : usuario === null ? null : (logins.get(usuario) ?? usuario));
  const alvo = ({ evento, alvo: id }: LinhaDoRegistro): string | null => {
    if (id === null) return null;
    if (evento === "ficha_consultada") return clientes.get(id) ?? `cliente ${id}`;
    if (evento === "entrada_recusada" && !chaves.has(id)) return "chave desconhecida";
    return logins.get(id) ?? chaves.get(id) ?? id;
  };
  return (linha) => ({ ...linha, quem: quem(linha.usuario), idDeQuem: linha.usuario, alvo: alvo(linha) });
}

function resumoDoLogin({ banco, agora }: Contexto, usuario: Usuario, nomes: ReadonlyMap<string, string>): LoginNaGestao {
  const ativas = resumoDasChavesDo(banco, usuario.id).filter((chave) => chave.revogadaEm === null);
  const ultimoConvite = convitesDo(banco, usuario.id, agora)[0] ?? null;
  return {
    id: usuario.id,
    nome: usuario.nome,
    papel: usuario.papel,
    situacao: situacaoDo(usuario, ativas.length, ultimoConvite),
    criadoEm: usuario.criadoEm,
    codigos: usuario.codigos.map((codigo) => ({ codigo, nome: nomes.get(codigo) ?? null })),
    chavesAtivas: ativas.length,
    provedores: [...new Set(ativas.map((chave) => chave.provedor))],
    ultimaEntrada: sessoesDo(banco, usuario.id, agora, 1)[0]?.criadaEm ?? null,
    sessoesAbertas: contarSessoesAbertas(banco, usuario.id, agora),
    ultimoConvite,
  };
}

function situacaoDo(usuario: Usuario, chavesAtivas: number, ultimoConvite: ConviteDoLogin | null): SituacaoDoLogin {
  if (!usuario.ativo) return "desativado";
  if (chavesAtivas > 0) return "ativo";
  return ultimoConvite?.estado === "valendo" ? "aguardando" : "sem_acesso";
}

function convidar({ banco, agora, origens }: Contexto, usuario: Usuario, ator: Ator): ConviteGerado {
  const { token, validoAte } = criarConvite(banco, { usuario: usuario.id, criadoPor: ator }, agora);
  auditar(banco, { usuario: ator, evento: "convite_criado", alvo: usuario.id });
  const origem = usuario.papel === "admin" ? origens.admin : origens.crm;
  return { idDoLogin: usuario.id, nome: usuario.nome, link: `${origem}/convite#${token}`, validoAte };
}

function loginDe({ banco }: Contexto, id: string): Usuario {
  const usuario = buscarUsuario(banco, id);
  if (!usuario) throw new LoginNaoEncontrado(`Nenhum login com o id ${id}.`);
  return usuario;
}

function loginAtivo(contexto: Contexto, id: string): Usuario {
  const usuario = loginDe(contexto, id);
  if (!usuario.ativo) throw new AcaoRecusada(`O login ${usuario.nome} está desativado.`);
  return usuario;
}

/** O admin não se tranca para fora: as ações que derrubam o próprio acesso ficam para outro admin ou para a linha de comando. */
function protegerOProprioLogin(usuario: Usuario, ator: Ator, acao: string): void {
  if (usuario.id === ator) throw new AcaoRecusada(`Você não pode ${acao} por aqui.`);
}

/** Os códigos que podem ser ligados a um login: a tabela de representantes da foto (CLAUDE.md, regra 4). */
function autorizadosDaFoto(contexto: Contexto): Set<string> {
  try {
    return new Set(representantesDa(contexto.foto()).keys());
  } catch (erro) {
    if (erro instanceof FotoIndisponivel) throw new AcaoRecusada("Ainda não há foto do ERP: rode o extrator antes de ligar códigos a um login.");
    throw erro;
  }
}

/** O nome de cada código, para mostrar; sem foto, os códigos aparecem sem nome. */
function nomesDosRepresentantes(contexto: Contexto): Map<string, string> {
  try {
    return representantesDa(contexto.foto());
  } catch (erro) {
    if (erro instanceof FotoIndisponivel) return new Map();
    throw erro;
  }
}

function representantesDa(foto: DatabaseSync): Map<string, string> {
  return new Map(
    foto
      .prepare("SELECT codigo, nome FROM representante ORDER BY CAST(codigo AS INTEGER)")
      .all()
      .map((linha) => [String(linha.codigo), String(linha.nome)]),
  );
}

function nomesDosClientes(foto: () => DatabaseSync, ids: readonly string[]): Map<string, string> {
  if (ids.length === 0) return new Map();
  try {
    return new Map(
      foto()
        .prepare(`SELECT cliente, nome FROM cliente WHERE cliente IN (${ids.map(() => "?").join(", ")})`)
        .all(...ids)
        .map((linha) => [String(linha.cliente), String(linha.nome)]),
    );
  } catch (erro) {
    if (erro instanceof FotoIndisponivel) return new Map();
    throw erro;
  }
}

function textoOuNulo(valor: unknown): string | null {
  return valor === null || valor === undefined ? null : String(valor);
}
