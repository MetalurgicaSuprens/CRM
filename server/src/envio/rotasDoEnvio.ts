import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { auditar } from "../auditoria.ts";
import type { FotoAtual } from "../foto/fotoAtual.ts";
import { conferirEntrada, opcoesParaConfirmar, type RespostaDeEntrada, type Site } from "../login/chaveDeAcesso.ts";
import { buscarChave, chavesAtivasDo, registrarUsoDaChave } from "../login/chaves.ts";
import type { Desafios } from "../login/desafios.ts";
import { CREDENCIAL_USADA } from "../login/rotasDoLogin.ts";
import { buscarUsuario } from "../login/usuarios.ts";
import { sessaoDa, type Sessao } from "../sessao.ts";
import { concluirEnvio, desafioDoEnvio, finalidadeDoEnvio, hashNoDesafio, lerPedidoEnviado, prepararEnvio, type EnvioPreparado } from "./pedidosEnviados.ts";

/*
 * As rotas do envio do pedido (F5). Primeiro a tela pede as opções da chave de acesso para o rascunho;
 * o desafio delas leva o hash do conteúdo. Depois manda a resposta do aparelho, e o servidor confere a
 * assinatura contra o rascunho como ele está: se mudou no meio, a confirmação não vale. Enquanto a LAN
 * não leva os pedidos ao SGI, o envio fica desligado na produção (sem pasta de saída).
 */

export type DependenciasDoEnvio = {
  banco: DatabaseSync;
  foto: FotoAtual;
  site: Site;
  desafios: Desafios;
  /** A caixa de saída; null deixa o envio desligado. */
  pastaDeSaida: string | null;
  agora: () => Date;
};

const DO_REPRESENTANTE = { config: { acesso: "representante" as const } };
const ENVIO_DESLIGADO = "O envio de pedidos pelo CRM ainda não foi liberado. O rascunho está salvo em Pedidos, na aba Rascunhos.";
const CONFIRMACAO_NAO_CONFERIDA = "Não deu para confirmar o envio com a chave de acesso. Confira o pedido e confirme de novo.";
const PEDIDO_NAO_ENCONTRADO = { erro: "Pedido não encontrado." };

/** O id do rascunho: o UUID versão 4 que a tela gera (rotas.ts). */
const PARAMETRO_RASCUNHO = {
  type: "object",
  properties: { id: { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$" } },
  required: ["id"],
  additionalProperties: false,
} as const;
const PARAMETRO_NUMERO = {
  type: "object",
  properties: { numero: { type: "string", pattern: "^CRM-\\d{5,9}$" } },
  required: ["numero"],
  additionalProperties: false,
} as const;
const CORPO_DA_CONFIRMACAO = { type: "object", properties: { resposta: CREDENCIAL_USADA }, required: ["resposta"], additionalProperties: false } as const;

type ComRascunho = { Params: { id: string } };

export function registrarRotasDoEnvio(app: FastifyInstance, dependencias: DependenciasDoEnvio): void {
  const { banco, foto } = dependencias;

  app.post<ComRascunho>("/api/rascunhos/:id/envio/opcoes", { ...DO_REPRESENTANTE, schema: { params: PARAMETRO_RASCUNHO } }, (requisicao, resposta) =>
    opcoesDoEnvio(dependencias, requisicao, resposta),
  );

  app.post<ComRascunho & { Body: { resposta: RespostaDeEntrada } }>(
    "/api/rascunhos/:id/envio",
    { ...DO_REPRESENTANTE, schema: { params: PARAMETRO_RASCUNHO, body: CORPO_DA_CONFIRMACAO } },
    (requisicao, resposta) => confirmarEnvio(dependencias, requisicao, requisicao.body.resposta, resposta),
  );

  app.get<{ Params: { numero: string } }>("/api/pedidos/enviados/:numero", { ...DO_REPRESENTANTE, schema: { params: PARAMETRO_NUMERO } }, (requisicao, resposta) => {
    const pedido = lerPedidoEnviado(banco, foto.abrir(), sessaoDa(requisicao), requisicao.params.numero);
    return pedido ?? resposta.code(404).send(PEDIDO_NAO_ENCONTRADO);
  });
}

async function opcoesDoEnvio({ banco, foto, site, desafios, pastaDeSaida, agora }: DependenciasDoEnvio, requisicao: FastifyRequest<ComRascunho>, resposta: FastifyReply) {
  const sessao = sessaoDa(requisicao);
  const { id } = requisicao.params;
  const envio = prepararEnvio(banco, foto.abrir(), sessao, id, agora());
  if ("status" in envio) return resposta.code(envio.status).send({ erro: envio.erro });
  if (!pastaDeSaida) return resposta.code(409).send({ erro: ENVIO_DESLIGADO });
  const opcoes = await opcoesParaConfirmar(site, desafioDoEnvio(envio.hash), chavesAtivasDo(banco, sessao.idDoUsuario));
  desafios.guardar(opcoes.challenge, finalidadeDoEnvio(sessao, id, envio.hash));
  return opcoes;
}

async function confirmarEnvio(
  dependencias: DependenciasDoEnvio,
  requisicao: FastifyRequest<ComRascunho>,
  credencial: RespostaDeEntrada,
  resposta: FastifyReply,
) {
  const { banco, foto, pastaDeSaida, agora } = dependencias;
  const sessao = sessaoDa(requisicao);
  const { id } = requisicao.params;
  const envio = prepararEnvio(banco, foto.abrir(), sessao, id, agora());
  if ("status" in envio) return resposta.code(envio.status).send({ erro: envio.erro });
  if (!pastaDeSaida) return resposta.code(409).send({ erro: ENVIO_DESLIGADO });
  const recusa = await recusaDaConfirmacao(dependencias, sessao, { id, envio, credencial });
  if (recusa) {
    auditar(banco, { usuario: sessao.idDoUsuario, evento: "envio_recusado", alvo: id, resultado: recusa });
    return resposta.code(400).send({ erro: CONFIRMACAO_NAO_CONFERIDA });
  }
  const pedido = concluirEnvio(banco, foto.abrir(), sessao, {
    idDoRascunho: id,
    envio,
    confirmacao: { chave: credencial.id, assinatura: credencial.response },
    pastaDeSaida,
    agora: agora(),
  });
  if (!pedido) return resposta.code(404).send({ erro: "Rascunho não encontrado." });
  auditar(banco, { usuario: sessao.idDoUsuario, evento: "pedido_enviado", alvo: pedido.numero });
  return pedido;
}

/**
 * O motivo para recusar a confirmação, para a auditoria; null se ela vale. A chave tem de ser ativa e
 * deste login, e a assinatura, de um desafio dado para este rascunho com este mesmo conteúdo.
 */
async function recusaDaConfirmacao(
  { banco, site, desafios, agora }: DependenciasDoEnvio,
  sessao: Sessao,
  { id, envio, credencial }: { id: string; envio: EnvioPreparado; credencial: RespostaDeEntrada },
): Promise<string | null> {
  const chave = buscarChave(banco, credencial.id);
  if (!chave || chave.usuario !== sessao.idDoUsuario) return "chave de outro login ou desconhecida";
  if (chave.revogada) return "chave revogada";
  const finalidade = finalidadeDoEnvio(sessao, id, envio.hash);
  const desafioValido = (desafio: string) => hashNoDesafio(desafio) === envio.hash && desafios.usar(desafio, finalidade);
  const conferencia = await conferirEntrada(site, credencial, { chave, desafioValido });
  if (!conferencia.ok) return conferencia.motivo;
  // A chave residente devolve o identificador do usuário: tem de ser o do dono da chave.
  if (credencial.response.userHandle !== buscarUsuario(banco, sessao.idDoUsuario)?.idWebauthn) return "usuário da chave não confere";
  registrarUsoDaChave(banco, { id: chave.id, contador: conferencia.valor.contador }, agora());
  return null;
}
