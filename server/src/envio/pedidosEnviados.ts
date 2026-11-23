import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { dataDoMomento, momentoEmBrasilia } from "dominio/datas";
import { conteudoCanonico } from "dominio/conteudoDoPedido";
import { DIAS_UTEIS_ATE_A_ENTREGA, numeroDoPedidoCrm, primeiraEntregaPossivel, totalDoPedido, valorDaLinha } from "dominio/pedido";
import type { ClienteResumo, Cotacao, EscolhasDoPedido, EtapaDoPedido, ItemDoPedido, ItemEnviado, PedidoDaFicha, PedidoEnviado } from "../../../web/src/dados/tipos.ts";
import { emTransacao } from "../bancoDoApp.ts";
import { lerResumoNaCarteira } from "../leituras/clientes.ts";
import { lerLinhas, texto, textoOuNulo } from "../leituras/linhas.ts";
import { lerCotacao, recusaDoConteudo, type RecusaDoCotacao } from "../cotacoes.ts";
import type { Sessao } from "../sessao.ts";
import { VERSAO_DO_ARQUIVO_DO_PEDIDO, gravarNaCaixaDeSaida } from "./caixaDeSaida.ts";

/*
 * O envio do pedido (F5, docs/plano.md, "Pedidos: caminho até o ERP"). A cotação vira pedido
 * enviado só com a chave de acesso confirmada de novo: o desafio que o aparelho assina leva o hash do
 * conteúdo, e o servidor só aceita a assinatura se a cotação ainda tiver esse mesmo conteúdo. O pedido
 * enviado ganha o número do CRM, não muda mais (o app.db recusa) e vai para a caixa de saída, de onde a
 * LAN o leva ao SGI. A situação dele no SGI volta pela foto.
 */

/** O que a chave confirma: a cotação como estava, já conferida contra a foto. */
export type ConteudoDoPedido = { cliente: string; itens: ItemDoPedido[]; entrega: string | null; observacao: string; escolhas: EscolhasDoPedido };
export type EnvioPreparado = { conteudo: ConteudoDoPedido; hash: string };
/** A prova da confirmação, guardada com o pedido: a chave e o que o aparelho assinou. */
export type Confirmacao = { chave: string; assinatura: object };

const NAO_ENCONTRADO: RecusaDoCotacao = { status: 404, erro: "Cotação não encontrada." };
const BYTES_ALEATORIOS_DO_DESAFIO = 16;
const ETAPAS_ANTES_DO_ERP: ReadonlySet<EtapaDoPedido> = new Set(["enviado", "recebido", "em_aprovacao", "aprovado"]);
const NUMERO_DO_CRM = /^CRM-(\d{5,9})$/;

/** A cotação do login pronta para confirmar, ou o motivo de ainda não poder ser enviada. */
export function prepararEnvio(banco: DatabaseSync, foto: DatabaseSync, sessao: Sessao, idDoCotacao: string, agora: Date): EnvioPreparado | RecusaDoCotacao {
  const cotacao = lerCotacao(banco, foto, sessao, idDoCotacao);
  if (!cotacao) return NAO_ENCONTRADO;
  const { itens, entrega, observacao } = cotacao;
  const recusa = recusaDoConteudo(foto, sessao, { codigoCliente: cotacao.cliente.codigo, itens, entrega });
  if (recusa) return recusa;
  const problema = problemaParaEnviar(cotacao, dataDoMomento(momentoEmBrasilia(agora)));
  if (problema || !cotacao.escolhas) return { status: 400, erro: problema ?? "Faltam as condições do pedido." };
  const conteudo = { cliente: cotacao.cliente.codigo, itens, entrega, observacao, escolhas: cotacao.escolhas };
  return { conteudo, hash: createHash("sha256").update(conteudoCanonico(conteudo)).digest("hex") };
}

/** O desafio que o aparelho assina: bytes aleatórios, para não se repetir, seguidos do hash do conteúdo. */
export function desafioDoEnvio(hash: string): Uint8Array {
  return new Uint8Array(Buffer.concat([randomBytes(BYTES_ALEATORIOS_DO_DESAFIO), Buffer.from(hash, "hex")]));
}

/** Para que o desafio vale: este login, esta cotação e este conteúdo. */
export function finalidadeDoEnvio(sessao: Sessao, idDoCotacao: string, hash: string): string {
  return `envio:${sessao.idDoUsuario}:${idDoCotacao}:${hash}`;
}

/** O hash que o desafio leva; o que o servidor confere é a finalidade, e isto amarra a assinatura ao conteúdo. */
export function hashNoDesafio(desafio: string): string {
  return Buffer.from(desafio, "base64url").subarray(BYTES_ALEATORIOS_DO_DESAFIO).toString("hex");
}

/**
 * Grava o pedido enviado, apaga a cotação e põe o pedido na caixa de saída, tudo ou nada. null se a
 * cotação já não existe (enviada em outra aba, por exemplo).
 */
export function concluirEnvio(
  banco: DatabaseSync,
  foto: DatabaseSync,
  sessao: Sessao,
  { idDoCotacao, envio, confirmacao, pastaDeSaida, agora }: { idDoCotacao: string; envio: EnvioPreparado; confirmacao: Confirmacao; pastaDeSaida: string; agora: Date },
): PedidoEnviado | null {
  const enviadoEm = momentoEmBrasilia(agora);
  const { conteudo, hash } = envio;
  const gravado: { arquivo?: string } = {};
  try {
    const numero = emTransacao(banco, () => {
      const apagados = banco.prepare("DELETE FROM cotacoes WHERE id = ? AND usuario = ?").run(idDoCotacao, sessao.idDoUsuario).changes;
      if (apagados === 0) return null;
      const linha = banco
        .prepare(
          `INSERT INTO pedidos_enviados (usuario, cliente, cotacao, conteudo, hash, chave, assinatura, enviado_em)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING numero`,
        )
        .get(sessao.idDoUsuario, conteudo.cliente, idDoCotacao, JSON.stringify(conteudo), hash, confirmacao.chave, JSON.stringify(confirmacao.assinatura), enviadoEm);
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

/**
 * Os enviados do login como linhas do histórico da ficha, como as cotações (cotacoesNaFicha), até o
 * pedido chegar ao ERP: de lá em diante, ele já está na ficha como pedido do Omega. O recusado e o
 * cancelado não viraram pedido e ficam fora, como na tela (web/src/dados/pedido.ts, STATUS_NA_FICHA).
 */
export function enviadosNaFicha(banco: DatabaseSync, foto: DatabaseSync, sessao: Sessao, ficha: { codigo: string; cnpjs: readonly ClienteResumo[] | null }): PedidoDaFicha[] {
  const codigos = new Set(ficha.cnpjs ? ficha.cnpjs.map(({ codigo }) => codigo) : [ficha.codigo]);
  return pedidosEnviadosDoLogin(banco, foto, sessao)
    .filter((pedido) => codigos.has(pedido.cliente.codigo) && ETAPAS_ANTES_DO_ERP.has(pedido.etapa))
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

/** O que falta para enviar, além do que a cotação já confere ao salvar; as mesmas regras da tela (web/src/dados/pedido.ts). */
function problemaParaEnviar(cotacao: Cotacao, hoje: string): string | null {
  if (cotacao.itens.length === 0) return "Inclua pelo menos um produto.";
  if (cotacao.escolhas?.transportadora === null) return "Escolha a transportadora.";
  const primeiraEntrega = primeiraEntregaPossivel(hoje);
  if (cotacao.entrega !== null && cotacao.entrega < primeiraEntrega) {
    return `A entrega desejada precisa ser a partir de ${primeiraEntrega.split("-").reverse().join("/")}: ${DIAS_UTEIS_ATE_A_ENTREGA} dias úteis depois de hoje.`;
  }
  return null;
}

function montarPedidoEnviado(foto: DatabaseSync, sessao: Sessao, linha: Record<string, unknown>): PedidoEnviado | null {
  const cliente = lerResumoNaCarteira(foto, sessao, String(linha.cliente));
  if (!cliente) return null;
  const conteudo = JSON.parse(String(linha.conteudo)) as ConteudoDoPedido;
  const enviadoEm = String(linha.enviado_em);
  const numero = numeroDoPedidoCrm(Number(linha.numero));
  return {
    numero,
    cliente,
    enviadoEm,
    entrega: conteudo.entrega,
    observacao: conteudo.observacao,
    itens: itensComProduto(foto, conteudo.itens),
    totalEstimado: totalDoPedido(conteudo.itens),
    ...andamentoNaFoto(foto, numero, enviadoEm),
  };
}

type Andamento = Pick<PedidoEnviado, "etapa" | "historico" | "numeroSgi" | "numeroErp" | "totalSgi" | "motivoRecusa">;

/** O andamento que a máquina do extrator mandou na foto (pedido_crm); sem linha lá, o pedido só foi enviado. */
function andamentoNaFoto(foto: DatabaseSync, numero: string, enviadoEm: string): Andamento {
  const enviado = { etapa: "enviado" as const, em: enviadoEm };
  const [linha] = lerLinhas(foto, "SELECT etapa, numero_sgi, numero_erp, total_sgi, motivo_recusa, historico FROM pedido_crm WHERE numero = ?", [numero]);
  if (!linha) return { etapa: "enviado", historico: [enviado], numeroSgi: null, numeroErp: null, totalSgi: null, motivoRecusa: null };
  return {
    etapa: texto(linha, "etapa") as EtapaDoPedido,
    historico: [enviado, ...(JSON.parse(texto(linha, "historico")) as PedidoEnviado["historico"])],
    numeroSgi: textoOuNulo(linha, "numero_sgi"),
    numeroErp: textoOuNulo(linha, "numero_erp"),
    totalSgi: linha.total_sgi === null ? null : Number(linha.total_sgi),
    motivoRecusa: textoOuNulo(linha, "motivo_recusa"),
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
