import type { FastifyInstance, FastifyRequest } from "fastify";
import type { FotoAtual } from "./foto/fotoAtual.ts";
import { lerAnalises } from "./leituras/analises.ts";
import { lerCarteira, lerFicha } from "./leituras/clientes.ts";
import { lerPainel } from "./leituras/painel.ts";
import { lerPedidos } from "./leituras/pedidos.ts";
import { lerSituacao } from "./leituras/situacao.ts";
import type { Sessao } from "./sessao.ts";

/*
 * As rotas que as telas chamam (web/src/dados/fonteDoServidor.ts). Todas são de representante:
 * o escopo é a sessão, e nenhuma recebe código de representante do navegador. Rota nova entra no
 * teste de escopo (app.test.ts), que percorre todas.
 */

const DO_REPRESENTANTE = { config: { acesso: "representante" as const } };

/** O id opaco do cliente: 16 caracteres hexadecimais (extrator/src/idDoCliente.ts). */
const PARAMETRO_CLIENTE = {
  type: "object",
  properties: { codigo: { type: "string", pattern: "^[0-9a-f]{16}$" } },
  required: ["codigo"],
  additionalProperties: false,
} as const;

export function registrarRotas(app: FastifyInstance, foto: FotoAtual): void {
  app.get("/api/situacao", DO_REPRESENTANTE, (requisicao) => lerSituacao(foto.abrir(), sessaoDa(requisicao)));
  app.get("/api/painel", DO_REPRESENTANTE, (requisicao) => lerPainel(foto.abrir(), sessaoDa(requisicao)));
  app.get("/api/clientes", DO_REPRESENTANTE, (requisicao) => lerCarteira(foto.abrir(), sessaoDa(requisicao)));
  app.get<{ Params: { codigo: string } }>(
    "/api/clientes/:codigo",
    { ...DO_REPRESENTANTE, schema: { params: PARAMETRO_CLIENTE } },
    (requisicao, resposta) => {
      const ficha = lerFicha(foto.abrir(), sessaoDa(requisicao), requisicao.params.codigo);
      return ficha ?? resposta.code(404).send({ erro: "Cliente não encontrado na sua carteira." });
    },
  );
  app.get("/api/analises", DO_REPRESENTANTE, (requisicao) => lerAnalises(foto.abrir(), sessaoDa(requisicao)));
  app.get("/api/pedidos", DO_REPRESENTANTE, (requisicao) => lerPedidos(foto.abrir(), sessaoDa(requisicao)));
}

/** A rota de representante só chega aqui com sessão (app.ts barra antes com 401). */
function sessaoDa(requisicao: FastifyRequest): Sessao {
  if (!requisicao.sessao) throw new Error("Rota de representante sem sessão.");
  return requisicao.sessao;
}
