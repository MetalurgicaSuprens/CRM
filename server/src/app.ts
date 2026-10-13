import Fastify, { type FastifyError, type FastifyInstance, type FastifyReply, type FastifyRequest, type RouteOptions } from "fastify";
import { FotoIndisponivel, type FotoAtual } from "./foto/fotoAtual.ts";
import { registrarRotas } from "./rotas.ts";
import type { FonteDeSessao } from "./sessao.ts";

/*
 * A API do CRM. Regras de segurança que valem para toda rota (CLAUDE.md, regras 4 a 6):
 * - toda rota declara `config.acesso`, ou o servidor não sobe;
 * - rota de representante sem sessão responde 401; o escopo vem sempre da sessão;
 * - erro interno não leva detalhe para o navegador;
 * - o log tem só método, rota, status, tempo e id do usuário.
 */

const LIMITE_DO_CORPO = 64 * 1024;

export type Dependencias = { foto: FotoAtual; sessaoDe: FonteDeSessao };

export function criarApp({ foto, sessaoDe }: Dependencias): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: LIMITE_DO_CORPO });
  app.decorate("rotasRegistradas", []);
  app.decorateRequest("sessao", null);
  app.addHook("onRoute", (rota) => exigirAcessoDeclarado(app, rota));
  app.addHook("onRequest", async (requisicao, resposta) => {
    requisicao.sessao = sessaoDe(requisicao);
    const acesso = requisicao.routeOptions.config.acesso;
    if (acesso === "representante" && !requisicao.sessao) return resposta.code(401).send({ erro: "Entre com a sua chave de acesso." });
    if (acesso === "admin") return resposta.code(404).send({ erro: "Não encontrado." });
  });
  app.addHook("onSend", async (_requisicao, resposta) => {
    resposta.header("Cache-Control", "no-store");
  });
  app.addHook("onResponse", async (requisicao, resposta) => registrarNoLog(requisicao, resposta));
  app.setErrorHandler(responderErro);
  app.setNotFoundHandler((_requisicao, resposta) => resposta.code(404).send({ erro: "Não encontrado." }));
  registrarRotas(app, foto);
  return app;
}

function exigirAcessoDeclarado(app: FastifyInstance, rota: RouteOptions): void {
  if (!rota.config?.acesso) throw new Error(`A rota ${rota.method} ${rota.url} não declara config.acesso.`);
  for (const metodo of [rota.method].flat()) app.rotasRegistradas.push({ metodo, url: rota.url });
}

function responderErro(erro: FastifyError, _requisicao: FastifyRequest, resposta: FastifyReply) {
  if (erro.validation) return resposta.code(400).send({ erro: "Pedido inválido." });
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
