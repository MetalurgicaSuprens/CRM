import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { dataDoMomento, momentoEmBrasilia } from "dominio/datas";
import { conteudoCanonico } from "dominio/conteudoDoPedido";
import { DIAS_UTEIS_ATE_A_ENTREGA, numeroDoPedidoCrm, primeiraEntregaPossivel, totalDoPedido, valorDaLinha } from "dominio/pedido";
import type { ClienteResumo, EscolhasDoPedido, ItemDoPedido, ItemEnviado, PedidoDaFicha, PedidoEnviado, Rascunho } from "../../../web/src/dados/tipos.ts";
import { emTransacao } from "../bancoDoApp.ts";
import { lerResumoNaCarteira } from "../leituras/clientes.ts";
import { lerLinhas, texto, textoOuNulo } from "../leituras/linhas.ts";
import { lerRascunho, recusaDoConteudo, type RecusaDoRascunho } from "../rascunhos.ts";
import type { Sessao } from "../sessao.ts";
import { VERSAO_DO_ARQUIVO_DO_PEDIDO, gravarNaCaixaDeSaida } from "./caixaDeSaida.ts";

/*
 * O envio do pedido (F5, docs/plano.md, "Pedidos: caminho até o ERP"). O rascunho vira pedido
 * enviado só com a chave de acesso confirmada de novo: o desafio que o aparelho assina leva o hash do
 * conteúdo, e o servidor só aceita a assinatura se o rascunho ainda tiver esse mesmo conteúdo. O pedido
 * enviado ganha o número do CRM, não muda mais (o app.db recusa) e vai para a caixa de saída, de onde a
 * LAN o leva ao SGI. A situação dele no SGI volta pela foto.
 */

/** O que a chave confirma: o rascunho como estava, já conferido contra a foto. */
export type ConteudoDoPedido = { cliente: string; itens: ItemDoPedido[]; entrega: string | null; observacao: string; escolhas: EscolhasDoPedido };
export type EnvioPreparado = { conteudo: ConteudoDoPedido; hash: string };
/** A prova da confirmação, guardada com o pedido: a chave e o que o aparelho assinou. */
export type Confirmacao = { chave: string; assinatura: object };

const NAO_ENCONTRADO: RecusaDoRascunho = { status: 404, erro: "Rascunho não encontrado." };
const BYTES_ALEATORIOS_DO_DESAFIO = 16;
const NUMERO_DO_CRM = /^CRM-(\d{5,9})$/;

/** O rascunho do login pronto para confirmar, ou o motivo de ainda não poder ser enviado. */
export function prepararEnvio(banco: DatabaseSync, foto: DatabaseSync, sessao: Sessao, idDoRascunho: string, agora: Date): EnvioPreparado | RecusaDoRascunho {
  const rascunho = lerRascunho(banco, foto, sessao, idDoRascunho);
  if (!rascunho) return NAO_ENCONTRADO;
  const { itens, entrega, observacao } = rascunho;
  const recusa = recusaDoConteudo(foto, sessao, { codigoCliente: rascunho.cliente.codigo, itens, entrega });
  if (recusa) return recusa;
  const problema = problemaParaEnviar(rascunho, dataDoMomento(momentoEmBrasilia(agora)));
  if (problema || !rascunho.escolhas) return { status: 400, erro: problema ?? "Faltam as condições do pedido." };
  const conteudo = { cliente: rascunho.cliente.codigo, itens, entrega, observacao, escolhas: rascunho.escolhas };
  return { conteudo, hash: createHash("sha256").update(conteudoCanonico(conteudo)).digest("hex") };
}

/** O desafio que o aparelho assina: bytes aleatórios, para não se repetir, seguidos do hash do conteúdo. */
export function desafioDoEnvio(hash: string): Uint8Array {
  return new Uint8Array(Buffer.concat([randomBytes(BYTES_ALEATORIOS_DO_DESAFIO), Buffer.from(hash, "hex")]));
}

/** Para que o desafio vale: este login, este rascunho e este conteúdo. */
export function finalidadeDoEnvio(sessao: Sessao, idDoRascunho: string, hash: string): string {
  return `envio:${sessao.idDoUsuario}:${idDoRascunho}:${hash}`;
}

/** O hash que o desafio leva; o que o servidor confere é a finalidade, e isto amarra a assinatura ao conteúdo. */
export function hashNoDesafio(desafio: string): string {
  return Buffer.from(desafio, "base64url").subarray(BYTES_ALEATORIOS_DO_DESAFIO).toString("hex");
}

/**
 * Grava o pedido enviado, apaga o rascunho e põe o pedido na caixa de saída, tudo ou nada. null se o
 * rascunho já não existe (enviado em outra aba, por exemplo).
 */
export function concluirEnvio(
  banco: DatabaseSync,
  foto: DatabaseSync,
  sessao: Sessao,
  { idDoRascunho, envio, confirmacao, pastaDeSaida, agora }: { idDoRascunho: string; envio: EnvioPreparado; confirmacao: Confirmacao; pastaDeSaida: string; agora: Date },
): PedidoEnviado | null {
  const enviadoEm = momentoEmBrasilia(agora);
  const { conteudo, hash } = envio;
  const gravado: { arquivo?: string } = {};
  try {
    const numero = emTransacao(banco, () => {
      const apagados = banco.prepare("DELETE FROM rascunhos WHERE id = ? AND usuario = ?").run(idDoRascunho, sessao.idDoUsuario).changes;
      if (apagados === 0) return null;
      const linha = banco
        .prepare(
          `INSERT INTO pedidos_enviados (usuario, cliente, rascunho, conteudo, hash, chave, assinatura, enviado_em)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING numero`,
        )
        .get(sessao.idDoUsuario, conteudo.cliente, idDoRascunho, JSON.stringify(conteudo), hash, confirmacao.chave, JSON.stringify(confirmacao.assinatura), enviadoEm);
      const numeroCrm = numeroDoPedidoCrm(Number(linha?.numero));
      gravado.arquivo = gravarNaCaixaDeSaida(pastaDeSaida, {
        versao: VERSAO_DO_ARQUIVO_DO_PEDIDO,
        numero: numeroCrm,
        enviadoEm,
        usuario: sessao.idDoUsuario,
        codigos: sessao.codigos,
        ...conteudo,
        hash,
      });
      return numeroCrm;
    });
    return numero ? lerPedidoEnviado(banco, foto, sessao, numero) : null;
  } catch (erro) {
    // O pedido que não entrou no app.db não pode ficar na caixa de saída.
    if (gravado.arquivo) fs.rmSync(gravado.arquivo, { force: true });
    throw erro;
  }
}

/** Os pedidos enviados pelo login, do mais novo ao mais antigo, só os de clientes ainda na carteira dele. */
export function pedidosEnviadosDoLogin(banco: DatabaseSync, foto: DatabaseSync, sessao: Sessao): PedidoEnviado[] {
  return banco
    .prepare("SELECT numero, cliente, conteudo, enviado_em FROM pedidos_enviados WHERE usuario = ? ORDER BY numero DESC")
    .all(sessao.idDoUsuario)
    .flatMap((linha) => montarPedidoEnviado(foto, sessao, linha) ?? []);
}

/** O pedido enviado pelo login, pelo número do CRM ("CRM-00106"); null se é de outro login ou não existe. */
export function lerPedidoEnviado(banco: DatabaseSync, foto: DatabaseSync, sessao: Sessao, numero: string): PedidoEnviado | null {
  const [, digitos] = NUMERO_DO_CRM.exec(numero) ?? [];
  if (!digitos) return null;
  const linha = banco.prepare("SELECT numero, cliente, conteudo, enviado_em FROM pedidos_enviados WHERE numero = ? AND usuario = ?").get(Number(digitos), sessao.idDoUsuario);
  return linha ? montarPedidoEnviado(foto, sessao, linha) : null;
}

/** Os enviados do login como linhas do histórico da ficha, como os rascunhos (rascunhosNaFicha). */
export function enviadosNaFicha(banco: DatabaseSync, foto: DatabaseSync, sessao: Sessao, ficha: { codigo: string; cnpjs: readonly ClienteResumo[] | null }): PedidoDaFicha[] {
  const codigos = new Set(ficha.cnpjs ? ficha.cnpjs.map(({ codigo }) => codigo) : [ficha.codigo]);
  return pedidosEnviadosDoLogin(banco, foto, sessao)
    .filter((pedido) => codigos.has(pedido.cliente.codigo))
    .map((pedido) => ({
      id: pedido.numero,
      cnpj: ficha.cnpjs ? { codigo: pedido.cliente.codigo, nome: pedido.cliente.nome } : null,
      numero: pedido.numero,
      status: "enviado",
      emissao: dataDoMomento(pedido.enviadoEm),
      entrega: pedido.entrega,
      itens: pedido.itens.map((item, i) => ({ ordem: i + 1, codigo: item.codigo, familia: item.familia, pecas: item.quantidade, valor: valorDaLinha(item), entrega: null })),
      valor: pedido.totalEstimado,
      valorComIpi: null,
      cfop: null,
      notas: [],
    }));
}

/** O que falta para enviar, além do que o rascunho já confere ao salvar; as mesmas regras da tela (web/src/dados/pedido.ts). */
function problemaParaEnviar(rascunho: Rascunho, hoje: string): string | null {
  if (rascunho.itens.length === 0) return "Inclua pelo menos um produto.";
  if (rascunho.escolhas?.transportadora === null) return "Escolha a transportadora.";
  const primeiraEntrega = primeiraEntregaPossivel(hoje);
  if (rascunho.entrega !== null && rascunho.entrega < primeiraEntrega) {
    return `A entrega desejada precisa ser a partir de ${primeiraEntrega.split("-").reverse().join("/")}: ${DIAS_UTEIS_ATE_A_ENTREGA} dias úteis depois de hoje.`;
  }
  return null;
}

function montarPedidoEnviado(foto: DatabaseSync, sessao: Sessao, linha: Record<string, unknown>): PedidoEnviado | null {
  const cliente = lerResumoNaCarteira(foto, sessao, String(linha.cliente));
  if (!cliente) return null;
  const conteudo = JSON.parse(String(linha.conteudo)) as ConteudoDoPedido;
  const enviadoEm = String(linha.enviado_em);
  return {
    numero: numeroDoPedidoCrm(Number(linha.numero)),
    cliente,
    enviadoEm,
    entrega: conteudo.entrega,
    observacao: conteudo.observacao,
    itens: itensComProduto(foto, conteudo.itens),
    totalEstimado: totalDoPedido(conteudo.itens),
    totalSgi: null,
    numeroSgi: null,
    numeroErp: null,
    etapa: "enviado",
    motivoRecusa: null,
    historico: [{ etapa: "enviado", em: enviadoEm }],
  };
}

/** A família e a medida vêm da foto de agora; o produto que saiu dela fica sem. */
function itensComProduto(foto: DatabaseSync, itens: readonly ItemDoPedido[]): ItemEnviado[] {
  const produtos = new Map(
    lerLinhas(foto, `SELECT produto, familia, medida FROM produto WHERE produto IN (${itens.map(() => "?").join(", ")})`, itens.map(({ codigo }) => codigo)).map((linha) => [
      texto(linha, "produto"),
      { familia: texto(linha, "familia"), medida: textoOuNulo(linha, "medida") },
    ]),
  );
  return itens.map((item) => ({ ...item, ...(produtos.get(item.codigo) ?? { familia: "", medida: null }) }));
}
