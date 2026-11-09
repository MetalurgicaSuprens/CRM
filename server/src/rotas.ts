import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { LIMITE_DA_OBSERVACAO } from "dominio/pedido";
import { AVISO_DE_PEDIDO_BLOQUEADO } from "dominio/statusDoCadastro";
import { auditar } from "./auditoria.ts";
import type { FotoAtual } from "./foto/fotoAtual.ts";
import { lerAnalises } from "./leituras/analises.ts";
import { lerCatalogo } from "./leituras/catalogo.ts";
import { isClienteDaCarteira, lerCarteira, lerFicha } from "./leituras/clientes.ts";
import { lerPainel } from "./leituras/painel.ts";
import { lerPedidos } from "./leituras/pedidos.ts";
import { lerSituacao } from "./leituras/situacao.ts";
import { LIMITE_DE_ITENS, excluirRascunho, lerRascunho, rascunhosDoLogin, rascunhosNaFicha, salvarRascunho, type ConteudoDoRascunho } from "./rascunhos.ts";
import type { Sessao } from "./sessao.ts";
import { dataDaVisita, desfazerVisita, registrarVisita, ultimasVisitas, visitasDosClientes, type ProblemaNaData } from "./visitas.ts";

/*
 * As rotas que as telas chamam (web/src/dados/fonteDoServidor.ts). Todas são de representante:
 * o escopo é a sessão, e nenhuma recebe código de representante do navegador. Rota nova entra no
 * teste de escopo (app.test.ts), que percorre todas.
 */

const DO_REPRESENTANTE = { config: { acesso: "representante" as const } };
const CLIENTE_FORA_DA_CARTEIRA = { erro: "Cliente não encontrado na sua carteira." };

/** O dia da visita é opcional: sem ele, vale hoje. */
const CORPO_DA_VISITA = {
  type: "object",
  properties: { data: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } },
  additionalProperties: false,
} as const;
const PROBLEMAS_NA_DATA: Record<ProblemaNaData, string> = {
  invalida: "Essa data não existe.",
  futura: "A visita não pode ser marcada para o futuro.",
  antiga: "A visita só pode ser marcada até 30 dias para trás.",
};

/** O id opaco do cliente: 16 caracteres hexadecimais (extrator/src/idDoCliente.ts). */
const PARAMETRO_CLIENTE = {
  type: "object",
  properties: { codigo: { type: "string", pattern: "^[0-9a-f]{16}$" } },
  required: ["codigo"],
  additionalProperties: false,
} as const;

/** O id do rascunho: o UUID versão 4 que a tela gera quando o pedido começa (novoIdDeRascunho, em web/src/dados/pedido.ts). */
const PARAMETRO_RASCUNHO = {
  type: "object",
  properties: { id: { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$" } },
  required: ["id"],
  additionalProperties: false,
} as const;
const RASCUNHO_NAO_ENCONTRADO = { erro: "Rascunho não encontrado." };

/**
 * O rascunho que a tela salva: o cliente, os itens (produto, peças e o preço do cento), a entrega e a
 * observação. O representante vem da sessão. O servidor confere o resto: cliente da carteira, produto
 * do catálogo dele e preço não abaixo da tabela (rascunhos.ts). A observação não leva caractere de
 * controle além da quebra de linha.
 */
const CORPO_DO_RASCUNHO = {
  type: "object",
  properties: {
    codigoCliente: { type: "string", pattern: "^[0-9a-f]{16}$" },
    itens: {
      type: "array",
      maxItems: LIMITE_DE_ITENS,
      items: {
        type: "object",
        properties: {
          codigo: { type: "string", pattern: "^[A-Za-z0-9][A-Za-z0-9./-]{0,19}$" },
          quantidade: { type: "integer", minimum: 1, maximum: 10_000_000 },
          precoCento: { type: "number", exclusiveMinimum: 0, maximum: 10_000_000 },
        },
        required: ["codigo", "quantidade", "precoCento"],
        additionalProperties: false,
      },
    },
    entrega: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    observacao: { type: "string", maxLength: LIMITE_DA_OBSERVACAO, pattern: "^[^\\u0000-\\u0009\\u000B-\\u001F\\u007F]*$" },
  },
  required: ["codigoCliente", "itens", "entrega", "observacao"],
  additionalProperties: false,
} as const;

export function registrarRotas(app: FastifyInstance, { foto, banco, agora = () => new Date() }: { foto: FotoAtual; banco: DatabaseSync; agora?: () => Date }): void {
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
      // No grupo, as visitas a qualquer CNPJ dele: a visita é sempre num CNPJ.
      const visitados = ficha.cnpjs ? ficha.cnpjs.map(({ codigo }) => codigo) : [ficha.codigo];
      // Os rascunhos do login entram no histórico, do mais recente ao mais antigo, como os pedidos.
      const pedidos = [...rascunhosNaFicha(banco, foto.abrir(), sessao, ficha), ...ficha.pedidos].sort((a, b) => b.emissao.localeCompare(a.emissao));
      return { ...ficha, pedidos, visitas: visitasDosClientes(banco, sessao.idDoUsuario, visitados) };
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
  app.get("/api/visitas", DO_REPRESENTANTE, (requisicao) => ultimasVisitas(banco, sessaoDa(requisicao).idDoUsuario));
  /**
   * Marca (POST) ou desmarca (DELETE) a visita de um dia, hoje se o corpo não diz. Só no cliente
   * sozinho ou no CNPJ de um grupo da carteira do login; no resto, 404, como a ficha.
   */
  for (const metodo of ["POST", "DELETE"] as const) {
    app.route<{ Params: { codigo: string }; Body: { data?: string } | undefined }>({
      method: metodo,
      url: "/api/clientes/:codigo/visitas",
      ...DO_REPRESENTANTE,
      schema: { params: PARAMETRO_CLIENTE, body: CORPO_DA_VISITA },
      handler: (requisicao, resposta) => {
        const sessao = sessaoDa(requisicao);
        const { codigo } = requisicao.params;
        if (!isClienteDaCarteira(foto.abrir(), sessao, codigo)) return resposta.code(404).send(CLIENTE_FORA_DA_CARTEIRA);
        const dia = dataDaVisita(requisicao.body?.data, agora());
        if ("problema" in dia) return resposta.code(400).send({ erro: PROBLEMAS_NA_DATA[dia.problema] });
        const visita = { usuario: sessao.idDoUsuario, cliente: codigo, data: dia.data };
        if (metodo === "POST") registrarVisita(banco, visita, agora());
        else desfazerVisita(banco, visita);
        auditar(banco, { usuario: sessao.idDoUsuario, evento: metodo === "POST" ? "visita_registrada" : "visita_desfeita", alvo: codigo });
        return { visitas: visitasDosClientes(banco, sessao.idDoUsuario, [codigo]) };
      },
    });
  }
  app.get("/api/pedidos", DO_REPRESENTANTE, (requisicao) => {
    const sessao = sessaoDa(requisicao);
    return { ...lerPedidos(foto.abrir(), sessao), rascunhos: rascunhosDoLogin(banco, foto.abrir(), sessao) };
  });
  /**
   * O rascunho do login: ler, salvar (criar ou atualizar pelo id que a tela gerou) e descartar. O de
   * outro login responde 404, como se não existisse.
   */
  app.get<{ Params: { id: string } }>(
    "/api/rascunhos/:id",
    { ...DO_REPRESENTANTE, schema: { params: PARAMETRO_RASCUNHO } },
    (requisicao, resposta) => lerRascunho(banco, foto.abrir(), sessaoDa(requisicao), requisicao.params.id) ?? resposta.code(404).send(RASCUNHO_NAO_ENCONTRADO),
  );
  app.put<{ Params: { id: string }; Body: ConteudoDoRascunho }>(
    "/api/rascunhos/:id",
    { ...DO_REPRESENTANTE, schema: { params: PARAMETRO_RASCUNHO, body: CORPO_DO_RASCUNHO } },
    (requisicao, resposta) => {
      const sessao = sessaoDa(requisicao);
      const resultado = salvarRascunho(banco, foto.abrir(), sessao, requisicao.params.id, requisicao.body, agora());
      if ("status" in resultado) return resposta.code(resultado.status).send({ erro: resultado.erro });
      // Só a criação: a tela salva sozinha a cada mudança.
      if (resultado.criado) auditar(banco, { usuario: sessao.idDoUsuario, evento: "rascunho_criado", alvo: requisicao.body.codigoCliente });
      return resultado.rascunho;
    },
  );
  app.delete<{ Params: { id: string } }>(
    "/api/rascunhos/:id",
    { ...DO_REPRESENTANTE, schema: { params: PARAMETRO_RASCUNHO } },
    (requisicao, resposta) => {
      const sessao = sessaoDa(requisicao);
      const cliente = excluirRascunho(banco, sessao, requisicao.params.id);
      if (!cliente) return resposta.code(404).send(RASCUNHO_NAO_ENCONTRADO);
      auditar(banco, { usuario: sessao.idDoUsuario, evento: "rascunho_descartado", alvo: cliente });
      return resposta.code(204).send();
    },
  );
}

/** A rota de representante só chega aqui com sessão (app.ts barra antes com 401). */
function sessaoDa(requisicao: FastifyRequest): Sessao {
  if (!requisicao.sessao) throw new Error("Rota de representante sem sessão.");
  return requisicao.sessao;
}
