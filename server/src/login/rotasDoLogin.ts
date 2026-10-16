import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance, FastifyReply } from "fastify";
import { auditar } from "../auditoria.ts";
import { emTransacao } from "../bancoDoApp.ts";
import {
  conferirCriacao,
  conferirEntrada,
  opcoesParaCriar,
  opcoesParaEntrar,
  type RespostaDeCriacao,
  type RespostaDeEntrada,
  type Site,
} from "./chaveDeAcesso.ts";
import { buscarChave, chavesAtivasDo, gravarChave, registrarUsoDaChave } from "./chaves.ts";
import { consultarConvite, usarConvite, type ConsultaDoConvite } from "./convites.ts";
import { cookieApagado, cookieDaSessao, lerTokenDoCookie } from "./cookie.ts";
import type { Desafios } from "./desafios.ts";
import type { Portal } from "./portal.ts";
import { abrirSessao, encerrarSessao } from "./sessoes.ts";
import { FORMATO_DO_TOKEN, hashDoToken } from "./token.ts";
import { buscarUsuario } from "./usuarios.ts";

/*
 * As rotas públicas do login (docs/plano.md, "Login e sessão"), iguais nos dois portais, o CRM e a
 * administração: o convite cria a chave de acesso e já abre a sessão; a entrada confere a chave e
 * abre a sessão; a saída a encerra. Cada portal só aceita convite e chave de login do seu papel.
 * Todas têm o limite por IP, e o servidor só aceita os POSTs da própria origem (app.ts).
 */

export type DependenciasDoLogin = { banco: DatabaseSync; site: Site; portal: Portal; desafios: Desafios; agora: () => Date };

const PUBLICA_COM_LIMITE = { acesso: "publico", limite: "login" } as const;
const ENTRADA = "entrada";

const CONVITE_SEM_VALOR = "Este convite não vale mais. Peça um novo ao administrador do CRM.";
const CHAVE_NAO_CONFERIDA = "A chave de acesso não pôde ser conferida. Tente de novo.";
const CHAVE_NAO_RECONHECIDA = "Esta chave de acesso não vale neste site ou foi apagada. Use outra chave ou peça um novo convite ao administrador do CRM.";
const CHAVE_DESATIVADA = "Esta chave de acesso foi desativada. Peça um novo convite ao administrador do CRM.";

const TOKEN = { type: "string", pattern: FORMATO_DO_TOKEN } as const;
const BASE64URL = { type: "string", pattern: "^[A-Za-z0-9_-]+$", maxLength: 16_000 } as const;
/** O id da credencial tem até 1.023 bytes (especificação WebAuthn): 1.364 caracteres em base64url. */
const ID_DA_CREDENCIAL = { type: "string", pattern: "^[A-Za-z0-9_-]+$", maxLength: 1_364 } as const;

/** O JSON da credencial da especificação WebAuthn, sem os campos que o servidor não usa. */
function credencialJson(resposta: object, obrigatorios: readonly string[]) {
  return {
    type: "object",
    properties: {
      id: ID_DA_CREDENCIAL,
      rawId: ID_DA_CREDENCIAL,
      type: { type: "string", const: "public-key" },
      authenticatorAttachment: { type: "string", enum: ["platform", "cross-platform"] },
      clientExtensionResults: { type: "object" },
      response: { type: "object", properties: resposta, required: obrigatorios, additionalProperties: false },
    },
    required: ["id", "rawId", "type", "response", "clientExtensionResults"],
    additionalProperties: false,
  } as const;
}

const CREDENCIAL_CRIADA = credencialJson(
  { clientDataJSON: BASE64URL, attestationObject: BASE64URL, transports: { type: "array", items: { type: "string", maxLength: 32 }, maxItems: 8 } },
  ["clientDataJSON", "attestationObject"],
);

const CREDENCIAL_USADA = credencialJson(
  { clientDataJSON: BASE64URL, authenticatorData: BASE64URL, signature: BASE64URL, userHandle: BASE64URL },
  ["clientDataJSON", "authenticatorData", "signature"],
);

const CORPO_DO_CONVITE = { type: "object", properties: { token: TOKEN }, required: ["token"], additionalProperties: false } as const;
const CORPO_DA_CHAVE_DO_CONVITE = {
  type: "object",
  properties: { token: TOKEN, resposta: CREDENCIAL_CRIADA },
  required: ["token", "resposta"],
  additionalProperties: false,
} as const;
const CORPO_DA_ENTRADA = { type: "object", properties: { resposta: CREDENCIAL_USADA }, required: ["resposta"], additionalProperties: false } as const;

export function registrarRotasDoLogin(app: FastifyInstance, dependencias: DependenciasDoLogin): void {
  const { banco, portal, agora } = dependencias;

  app.post<{ Body: { token: string } }>("/api/convite/consultar", { config: PUBLICA_COM_LIMITE, schema: { body: CORPO_DO_CONVITE } }, (requisicao) => {
    const consulta = conviteDoPortal(dependencias, requisicao.body.token);
    return consulta.estado === "valido" ? { estado: consulta.estado, nome: consulta.nome, validoAte: consulta.validoAte } : { estado: consulta.estado };
  });

  app.post<{ Body: { token: string } }>("/api/convite/opcoes", { config: PUBLICA_COM_LIMITE, schema: { body: CORPO_DO_CONVITE } }, (requisicao, resposta) =>
    opcoesDoConvite(dependencias, requisicao.body.token, resposta),
  );

  app.post<{ Body: { token: string; resposta: RespostaDeCriacao } }>(
    "/api/convite/chave",
    { config: PUBLICA_COM_LIMITE, schema: { body: CORPO_DA_CHAVE_DO_CONVITE } },
    (requisicao, resposta) => criarChaveDoConvite(dependencias, requisicao.body, resposta),
  );

  app.post("/api/entrar/opcoes", { config: PUBLICA_COM_LIMITE }, async () => {
    const opcoes = await opcoesParaEntrar(dependencias.site);
    dependencias.desafios.guardar(opcoes.challenge, ENTRADA);
    return opcoes;
  });

  app.post<{ Body: { resposta: RespostaDeEntrada } }>("/api/entrar", { config: PUBLICA_COM_LIMITE, schema: { body: CORPO_DA_ENTRADA } }, (requisicao, resposta) =>
    entrar(dependencias, requisicao.body.resposta, resposta),
  );

  // Pública: quem tem a sessão vencida também sai, e o cookie velho é apagado.
  app.post("/api/sair", { config: { acesso: "publico" } }, (requisicao, resposta) => {
    const token = lerTokenDoCookie(portal.cookie, requisicao.headers.cookie);
    const usuario = token ? encerrarSessao(banco, token, "saiu", agora()) : null;
    if (usuario) auditar(banco, { usuario, evento: "saida" });
    return resposta.code(204).header("Set-Cookie", cookieApagado(portal.cookie)).header("Clear-Site-Data", '"cache", "cookies", "storage"').send();
  });
}

async function opcoesDoConvite(dependencias: DependenciasDoLogin, token: string, resposta: FastifyReply) {
  const { banco, site, desafios } = dependencias;
  const consulta = conviteDoPortal(dependencias, token);
  const usuario = consulta.estado === "valido" ? buscarUsuario(banco, consulta.usuario) : null;
  if (!usuario) return resposta.code(410).send({ erro: CONVITE_SEM_VALOR });
  const opcoes = await opcoesParaCriar(site, usuario, chavesAtivasDo(banco, usuario.id));
  desafios.guardar(opcoes.challenge, finalidadeDoConvite(token));
  return opcoes;
}

async function criarChaveDoConvite(
  dependencias: DependenciasDoLogin,
  { token, resposta: credencial }: { token: string; resposta: RespostaDeCriacao },
  resposta: FastifyReply,
) {
  const { banco, site, portal, desafios, agora } = dependencias;
  const consulta = conviteDoPortal(dependencias, token);
  if (consulta.estado !== "valido") return resposta.code(410).send({ erro: CONVITE_SEM_VALOR });
  const recusar = (resultado: string) => {
    auditar(banco, { usuario: consulta.usuario, evento: "chave_recusada", resultado });
    return resposta.code(400).send({ erro: CHAVE_NAO_CONFERIDA });
  };
  const conferencia = await conferirCriacao(site, credencial, (desafio) => desafios.usar(desafio, finalidadeDoConvite(token)));
  if (!conferencia.ok) return recusar(conferencia.motivo);
  // A credencial já gravada não é nova: o aparelho de verdade se recusa a criar a mesma chave de novo.
  if (buscarChave(banco, conferencia.valor.id)) return recusar("chave já gravada");
  const momento = agora();
  const chave = { ...conferencia.valor, usuario: consulta.usuario };
  // O convite só é usado junto com a chave gravada: dois pedidos com o mesmo convite, um consegue.
  const tokenDaSessao = emTransacao(banco, () => {
    if (!usarConvite(banco, token, momento)) return null;
    gravarChave(banco, chave, momento);
    return abrirSessao(banco, { usuario: chave.usuario, chave: chave.id }, momento);
  });
  if (!tokenDaSessao) return resposta.code(410).send({ erro: CONVITE_SEM_VALOR });
  auditar(banco, { usuario: chave.usuario, evento: "chave_criada", alvo: chave.id });
  auditar(banco, { usuario: chave.usuario, evento: "entrada", alvo: chave.id });
  return resposta.code(204).header("Set-Cookie", cookieDaSessao(portal.cookie, tokenDaSessao)).send();
}

async function entrar({ banco, site, portal, desafios, agora }: DependenciasDoLogin, credencial: RespostaDeEntrada, resposta: FastifyReply) {
  const chave = buscarChave(banco, credencial.id);
  if (!chave) {
    auditar(banco, { usuario: null, evento: "entrada_recusada", alvo: credencial.id, resultado: "chave desconhecida" });
    return resposta.code(401).send({ erro: CHAVE_NAO_RECONHECIDA });
  }
  const recusar = (resultado: string, status: number, erro: string) => {
    auditar(banco, { usuario: chave.usuario, evento: "entrada_recusada", alvo: chave.id, resultado });
    return resposta.code(status).send({ erro });
  };
  const conferencia = await conferirEntrada(site, credencial, { chave, desafioValido: (desafio) => desafios.usar(desafio, ENTRADA) });
  if (!conferencia.ok) return recusar(conferencia.motivo, 401, CHAVE_NAO_CONFERIDA);
  const usuario = buscarUsuario(banco, chave.usuario);
  // A chave residente devolve o identificador do usuário: tem de ser o do dono da chave.
  if (!usuario || credencial.response.userHandle !== usuario.idWebauthn) return recusar("usuário da chave não confere", 401, CHAVE_NAO_CONFERIDA);
  // A chave do admin não abre o CRM, e a do representante não abre a administração.
  if (usuario.papel !== portal.papel) return recusar(`chave de ${usuario.papel} no portal de ${portal.papel}`, 401, CHAVE_NAO_RECONHECIDA);
  if (chave.revogada || !usuario.ativo) return recusar(chave.revogada ? "chave revogada" : "usuário desativado", 403, CHAVE_DESATIVADA);
  const momento = agora();
  registrarUsoDaChave(banco, { id: chave.id, contador: conferencia.valor.contador }, momento);
  const tokenDaSessao = abrirSessao(banco, { usuario: usuario.id, chave: chave.id }, momento);
  auditar(banco, { usuario: usuario.id, evento: "entrada", alvo: chave.id });
  return resposta.code(204).header("Set-Cookie", cookieDaSessao(portal.cookie, tokenDaSessao)).send();
}

/** O convite de um login de outro papel não existe para este portal. */
function conviteDoPortal({ banco, portal, agora }: DependenciasDoLogin, token: string): ConsultaDoConvite {
  const consulta = consultarConvite(banco, token, agora());
  return consulta.estado === "valido" && consulta.papel !== portal.papel ? { estado: "invalido" } : consulta;
}

/** O desafio da criação vale só para o convite que o pediu. */
function finalidadeDoConvite(token: string): string {
  return `convite:${hashDoToken(token)}`;
}
