import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { AVISO_DE_PEDIDO_BLOQUEADO } from "dominio/statusDoCadastro";
import { auditar } from "./auditoria.ts";
import type { FotoAtual } from "./foto/fotoAtual.ts";
import { lerAnalises } from "./leituras/analises.ts";
import { lerCatalogo } from "./leituras/catalogo.ts";
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
const CLIENTE_FORA_DA_CARTEIRA = { erro: "Cliente não encontrado na sua carteira." };

/** O id opaco do cliente: 16 caracteres hexadecimais (extrator/src/idDoCliente.ts). */
const PARAMETRO_CLIENTE = {
  type: "object",
  properties: { codigo: { type: "string", pattern: "^[0-9a-f]{16}$" } },
  required: ["codigo"],
  additionalProperties: false,
} as const;

export function registrarRotas(app: FastifyInstance, { foto, banco }: { foto: FotoAtual; banco: DatabaseSync }): void {
  app.get("/api/situacao", DO_REPRESENTANTE, (requisicao) => lerSituacao(foto.abrir(), sessaoDa(requisicao)));
  app.get("/api/painel", DO_REPRESENTANTE, (requisicao) => lerPainel(foto.abrir(), sessaoDa(requisicao)));
  app.get("/api/clientes", DO_REPRESENTANTE, (requisicao) => lerCarteira(foto.abrir(), sessaoDa(requisicao)));
  app.get<{ Params: { codigo: string } }>(
    "/api/clientes/:codigo",
    { ...DO_REPRESENTANTE, schema: { params: PARAMETRO_CLIENTE } },
    (requisicao, resposta) => {
      const sessao = sessaoDa(requisicao);
      const ficha = lerFicha(foto.abrir(), sessao, requisicao.params.codigo);
      if (!ficha) return resposta.code(404).send(CLIENTE_FORA_DA_CARTEIRA);
      auditar(banco, { usuario: sessao.idDoUsuario, evento: "ficha_consultada", alvo: requisicao.params.codigo });
      return ficha;
    },
  );
  app.get<{ Params: { codigo: string } }>(
    "/api/clientes/:codigo/catalogo",
    { ...DO_REPRESENTANTE, schema: { params: PARAMETRO_CLIENTE } },
    (requisicao, resposta) => {
      const resultado = lerCatalogo(foto.abrir(), sessaoDa(requisicao), requisicao.params.codigo);
      if (!resultado) return resposta.code(404).send(CLIENTE_FORA_DA_CARTEIRA);
      // 409: o cliente existe e é do login, mas está fora de ativo no cadastro e não recebe pedido.
      if ("foraDeAtivo" in resultado) return resposta.code(409).send({ erro: AVISO_DE_PEDIDO_BLOQUEADO[resultado.foraDeAtivo] });
      return resultado.catalogo;
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
