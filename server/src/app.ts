import type { DatabaseSync } from "node:sqlite";
import Fastify, { type FastifyError, type FastifyInstance, type FastifyReply, type FastifyRequest, type RouteOptions } from "fastify";
import { FotoIndisponivel, type FotoAtual } from "./foto/fotoAtual.ts";
import { criarLimitador, type Limite } from "./limite.ts";
import { siteDaOrigem } from "./login/chaveDeAcesso.ts";
import { COOKIE_APAGADO, lerTokenDoCookie } from "./login/cookie.ts";
import { criarDesafios } from "./login/desafios.ts";
import { registrarRotasDoLogin } from "./login/rotasDoLogin.ts";
import { usarSessao, type ConsultaDaSessao } from "./login/sessoes.ts";
import { registrarRotas } from "./rotas.ts";

/*
 * A API do CRM. Regras de segurança que valem para toda rota (CLAUDE.md, regras 4 a 6):
 * - toda rota declara `config.acesso`, ou o servidor não sobe;
 * - rota de representante sem sessão responde 401; o escopo vem sempre da sessão;
 * - pedido que altera algo só vale da própria origem;
 * - limite de requisições por IP no login e nos convites, e por usuário no resto;
 * - erro interno não leva detalhe para o navegador;
 * - o log tem só método, rota, status, tempo e id do usuário.
 */

const LIMITE_DO_CORPO = 64 * 1024;
/** Só o Apache, nesta máquina, informa o IP de quem chamou (X-Forwarded-For); ele apaga o que vem de fora. */
const PROXY_CONFIAVEL = "127.0.0.1";
const LIMITE_DO_LOGIN: Limite = { maximo: 30, janelaMs: 10 * 60_000 };
const LIMITE_DO_USUARIO: Limite = { maximo: 600, janelaMs: 10 * 60_000 };
const METODOS_DE_LEITURA = new Set(["GET", "HEAD"]);
const SEM_SESSAO: ConsultaDaSessao = { sessao: null, motivo: null };
const MUITOS_PEDIDOS = "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";

export type Dependencias = {
  foto: FotoAtual;
  banco: DatabaseSync;
  /** O endereço do CRM (esquema, domínio e porta), como o navegador o declara. */
  origem: string;
  agora?: () => Date;
};

export function criarApp({ foto, banco, origem, agora = () => new Date() }: Dependencias): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: LIMITE_DO_CORPO, trustProxy: PROXY_CONFIAVEL });
  const limiteDoLogin = criarLimitador(LIMITE_DO_LOGIN);
  const limiteDoUsuario = criarLimitador(LIMITE_DO_USUARIO);
  app.decorate("rotasRegistradas", []);
  app.decorateRequest("sessao", null);
  app.addHook("onRoute", (rota) => exigirAcessoDeclarado(app, rota));
  app.addHook("onRequest", async (requisicao, resposta) => {
    const { acesso, limite } = requisicao.routeOptions.config;
    if (acesso === "admin") return resposta.code(404).send({ erro: "Não encontrado." });
    if (!isDaPropriaOrigem(requisicao, origem)) return resposta.code(403).send({ erro: "Pedido de outra origem." });
    if (limite === "login" && !limiteDoLogin.permitir(requisicao.ip)) return resposta.code(429).send({ erro: MUITOS_PEDIDOS });
    const token = lerTokenDoCookie(requisicao.headers.cookie);
    const consulta = token ? usarSessao(banco, token, agora()) : SEM_SESSAO;
    requisicao.sessao = consulta.sessao;
    if (acesso !== "representante") return;
    if (!consulta.sessao) {
      // O cookie de uma sessão que terminou sai junto: a tela de entrada explica o motivo uma vez só.
      if (token) resposta.header("Set-Cookie", COOKIE_APAGADO);
      return resposta.code(401).send({ erro: "Entre com a sua chave de acesso.", motivo: consulta.motivo });
    }
    if (!limiteDoUsuario.permitir(consulta.sessao.idDoUsuario)) return resposta.code(429).send({ erro: MUITOS_PEDIDOS });
  });
  app.addHook("onSend", async (_requisicao, resposta) => {
    resposta.header("Cache-Control", "no-store");
  });
  app.addHook("onResponse", async (requisicao, resposta) => registrarNoLog(requisicao, resposta));
  app.setErrorHandler(responderErro);
  app.setNotFoundHandler((_requisicao, resposta) => resposta.code(404).send({ erro: "Não encontrado." }));
  registrarRotas(app, { foto, banco });
  registrarRotasDoLogin(app, { banco, site: siteDaOrigem(origem), desafios: criarDesafios(), agora });
  return app;
}

function exigirAcessoDeclarado(app: FastifyInstance, rota: RouteOptions): void {
  if (!rota.config?.acesso) throw new Error(`A rota ${rota.method} ${rota.url} não declara config.acesso.`);
  for (const metodo of [rota.method].flat()) app.rotasRegistradas.push({ metodo, url: rota.url, acesso: rota.config.acesso });
}

/**
 * Pedido que altera algo só vale da própria origem (docs/plano.md, "Sessão"): um site de fora não
 * age em nome de quem está com o CRM aberto. Sem o Origin, vale o Sec-Fetch-Site do navegador.
 */
function isDaPropriaOrigem(requisicao: FastifyRequest, origem: string): boolean {
  if (METODOS_DE_LEITURA.has(requisicao.method)) return true;
  const declarada = requisicao.headers.origin;
  if (declarada !== undefined) return declarada === origem;
  return requisicao.headers["sec-fetch-site"] === "same-origin";
}

function responderErro(erro: FastifyError, _requisicao: FastifyRequest, resposta: FastifyReply) {
  if (erro.validation) return resposta.code(400).send({ erro: "Pedido inválido." });
  // JSON malformado, corpo grande demais, tipo de conteúdo errado: o erro é do pedido, sem detalhe.
  if (erro.statusCode !== undefined && erro.statusCode >= 400 && erro.statusCode < 500) return resposta.code(erro.statusCode).send({ erro: "Pedido inválido." });
  if (erro instanceof FotoIndisponivel) {
    console.error(erro.message);
    return resposta.code(503).send({ erro: "Os dados ainda não chegaram do ERP." });
  }
  console.error(erro);
  return resposta.code(500).send({ erro: "Erro interno." });
}

function registrarNoLog(requisicao: FastifyRequest, resposta: FastifyReply): void {
  const rota = requisicao.routeOptions.url ?? "(sem rota)";
  const usuario = requisicao.sessao?.idDoUsuario ?? "-";
  console.log(`${requisicao.method} ${rota} ${resposta.statusCode} ${Math.round(resposta.elapsedTime)} ms ${usuario}`);
}
