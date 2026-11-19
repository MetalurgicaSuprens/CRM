import {
  DIAS_UTEIS_ATE_A_ENTREGA,
  LIMITE_DA_OBSERVACAO,
  MAIOR_ITEM_DA_ORDEM_DE_COMPRA,
  arredondarAoCentavo,
  pecasEmCentos,
  primeiraEntregaPossivel,
  type OrdemDeCompraDoItem,
} from "dominio/pedido";
import { formatarData } from "../formato";
import type { EtapaDoPedido, ItemDoPedido, PedidoEnviado, ProdutoDoCatalogo, StatusDoPedido } from "./tipos";

/*
 * Regras do pedido na tela. O preço do item é o da última compra do cliente, que o representante pode
 * mudar, nunca abaixo da tabela dele (pedido do Lucas em 2026-11-05). O valor e o total são contas do
 * dominio/pedido.ts, iguais às do servidor; a LAN revalida tudo no Oracle.
 */

export type LinhaDoPedido = {
  codigo: string;
  /** Em peças. */
  quantidade: number;
  /** Peças por embalagem: os botões da quantidade andam de embalagem em embalagem. */
  embalagem: number;
  /** Preço do cento do item: o da última compra, o que o representante pôs ou o da tabela. */
  precoCento: number;
};

/** O preço com que o item entra no pedido: o da última compra do cliente, mas nunca abaixo da tabela dele, que é o mínimo. */
export function precoInicialDoItem(produto: Pick<ProdutoDoCatalogo, "precoDaTabela" | "ultimaCompra">): number {
  return Math.max(produto.ultimaCompra?.precoCento ?? 0, produto.precoDaTabela);
}

/**
 * O preço do cento que o representante digitou, no centavo: "123,45", "1.234,56" ou "123.45". Abaixo
 * do mínimo (a tabela do cliente com o desconto dele) sobe para o mínimo. O que não é preço volta null,
 * e o campo fica com o preço de antes.
 */
export function precoDigitado(texto: string, minimo: number): { preco: number; subiuAoMinimo: boolean } | null {
  const preco = arredondarAoCentavo(numeroDigitado(texto));
  if (!Number.isFinite(preco) || preco <= 0) return null;
  return preco < minimo ? { preco: minimo, subiuAoMinimo: true } : { preco, subiuAoMinimo: false };
}

/**
 * O rascunho salvo diante do catálogo de hoje: o produto que saiu da lista do cliente sai do pedido, e o
 * preço que ficou abaixo da tabela (ela subiu) sobe para ela. Diz quantos de cada, para a tela avisar.
 */
export function rascunhoNoCatalogo(
  itens: readonly ItemDoPedido[],
  produtos: readonly Pick<ProdutoDoCatalogo, "codigo" | "precoDaTabela">[],
): { itens: ItemDoPedido[]; foraDoCatalogo: number; subiramAoMinimo: number } {
  const tabela = new Map(produtos.map((produto) => [produto.codigo, produto.precoDaTabela]));
  const noCatalogo = itens.filter((item) => tabela.has(item.codigo));
  const minimoDe = (item: ItemDoPedido) => tabela.get(item.codigo) ?? item.precoCento;
  return {
    itens: noCatalogo.map((item) => ({ ...item, precoCento: Math.max(item.precoCento, minimoDe(item)) })),
    foraDoCatalogo: itens.length - noCatalogo.length,
    subiramAoMinimo: noCatalogo.filter((item) => item.precoCento < minimoDe(item)).length,
  };
}

/** Com vírgula, o ponto separa os milhares; sem ela, o ponto com até duas casas depois é o decimal. */
function numeroDigitado(texto: string): number {
  const limpo = texto.replace(/R\$|\s/g, "");
  if (limpo.includes(",")) return Number(limpo.replace(/\./g, "").replace(",", "."));
  return Number(/^\d+\.\d{1,2}$/.test(limpo) ? limpo : limpo.replace(/\./g, ""));
}

/**
 * A quantidade digitada, em peças inteiras, como está: também fora da embalagem, porque pedir 300
 * peças de um item de 500 é o dia a dia (decisão do Lucas em 2026-10-20). Inválida ou zerada vira zero.
 */
export function quantidadeDigitada(texto: string): number {
  const pecas = Math.round(Number(texto));
  return Number.isFinite(pecas) && pecas > 0 ? pecas : 0;
}

/** Um produto do pedido, as peças e a ordem de compra do cliente nele, na ordem em que o representante incluiu. */
export type ItemEscolhido = OrdemDeCompraDoItem & { codigo: string; quantidade: number };

/** O item novo: a ordem de compra é a do pedido, sem item, como o SGI6R preenche. */
export const SEM_ORDEM_DE_COMPRA_NO_ITEM: OrdemDeCompraDoItem = { ordemDeCompra: null, itemDaOrdemDeCompra: null };

/**
 * O pedido com a quantidade nova do produto: o que já está nele fica no lugar, o novo entra no fim,
 * como numa nota, e o que zera sai.
 */
export function comQuantidade(itens: readonly ItemEscolhido[], codigo: string, quantidade: number): ItemEscolhido[] {
  if (quantidade <= 0) return itens.filter((item) => item.codigo !== codigo);
  if (!itens.some((item) => item.codigo === codigo)) return [...itens, { codigo, quantidade, ...SEM_ORDEM_DE_COMPRA_NO_ITEM }];
  return itens.map((item) => (item.codigo === codigo ? { ...item, quantidade } : item));
}

/** O pedido com a ordem de compra nova no item do produto. */
export function comOrdemDeCompra(itens: readonly ItemEscolhido[], codigo: string, ordem: OrdemDeCompraDoItem): ItemEscolhido[] {
  return itens.map((item) => (item.codigo === codigo ? { ...item, ...ordem } : item));
}

/**
 * A ordem de compra que o representante digitou no item: vazia, ou igual à do pedido, é a do pedido
 * (null), que acompanha a do pedido se ela mudar.
 */
export function ordemDeCompraDigitada(texto: string, doPedido: string): string | null {
  const limpa = texto.trim();
  return limpa === "" || limpa === doPedido.trim() ? null : limpa;
}

/** O item da ordem de compra digitado: de 1 a 999999, como na nota fiscal. Vazio é sem item; o que não é número volta undefined, e o campo fica como estava. */
export function itemDaOrdemDigitado(texto: string): number | null | undefined {
  const limpo = texto.trim();
  if (limpo === "") return null;
  if (!/^\d{1,6}$/.test(limpo)) return undefined;
  const item = Number(limpo);
  return item >= 1 && item <= MAIOR_ITEM_DA_ORDEM_DE_COMPRA ? item : undefined;
}

/** Um item do pedido com tudo o que a tela mostra dele: o produto do catálogo, as peças e o preço do cento. */
export type LinhaEscolhida = ProdutoDoCatalogo & OrdemDeCompraDoItem & { quantidade: number; precoCento: number };

/**
 * Os itens do pedido, na ordem em que entraram, com o produto do catálogo e o preço: o que o
 * representante mudou ou, sem mudança, o preço inicial do item. O produto que saiu do catálogo fica de fora.
 */
export function linhasEscolhidas(itens: readonly ItemEscolhido[], precos: Readonly<Record<string, number>>, produtos: readonly ProdutoDoCatalogo[]): LinhaEscolhida[] {
  const noCatalogo = new Map(produtos.map((produto) => [produto.codigo, produto]));
  return itens.flatMap(({ codigo, quantidade, ordemDeCompra, itemDaOrdemDeCompra }) => {
    const produto = noCatalogo.get(codigo);
    return produto && quantidade > 0 ? [{ ...produto, quantidade, precoCento: precos[codigo] ?? precoInicialDoItem(produto), ordemDeCompra, itemDaOrdemDeCompra }] : [];
  });
}

/** O botão "+": a próxima embalagem fechada. De 300, num item de 500, vai a 500; de 500, a 1.000. */
export function proximaEmbalagem(pecas: number, embalagem: number): number {
  return (Math.floor(pecas / embalagem) + 1) * embalagem;
}

/** O botão "−": a embalagem fechada de baixo. De 300, num item de 500, vai a 0; de 1.200, a 1.000. */
export function embalagemAnterior(pecas: number, embalagem: number): number {
  return Math.max(0, (Math.ceil(pecas / embalagem) - 1) * embalagem);
}

/** O preço do cento que o item do ERP pagou: o caminho de volta de valorDaLinha. Sem peças, 0. */
export function precoDoCento(item: { pecas: number; valor: number }): number {
  return item.pecas > 0 ? item.valor / pecasEmCentos(item.pecas) : 0;
}

/** Peças e valor de uma família no pedido; serve também para um item só. */
export type TotalDaFamilia = { familia: string; pecas: number; valor: number };

/** O resumo do pedido aberto na lista: as famílias, da de maior valor à de menor, com a soma de cada uma. */
export function resumirPorFamilia(itens: readonly TotalDaFamilia[]): TotalDaFamilia[] {
  const porFamilia = new Map<string, TotalDaFamilia>();
  for (const { familia, pecas, valor } of itens) {
    const total = porFamilia.get(familia) ?? { familia, pecas: 0, valor: 0 };
    porFamilia.set(familia, { familia, pecas: total.pecas + pecas, valor: total.valor + valor });
  }
  return [...porFamilia.values()].sort((a, b) => b.valor - a.valor);
}

export type PassoDoAndamento = {
  etapa: EtapaDoPedido;
  estado: "feito" | "atual" | "futuro";
  /** Quando o pedido chegou ao passo; só nos passos feitos e no atual. */
  em: string | null;
};

const CAMINHO_NORMAL: EtapaDoPedido[] = ["enviado", "recebido", "em_aprovacao", "aprovado", "no_erp", "faturado"];

/**
 * Os passos para mostrar ao representante: o caminho normal até o faturamento, com o que já
 * aconteceu, o passo atual e o que falta. Recusado e cancelado encerram o caminho onde pararam.
 */
export function passosDoAndamento(pedido: Pick<PedidoEnviado, "etapa" | "historico">): PassoDoAndamento[] {
  const quando = new Map(pedido.historico.map((registro) => [registro.etapa, registro.em]));
  const encerrado = pedido.etapa === "recusado" || pedido.etapa === "cancelado";
  const caminho = encerrado
    ? pedido.historico.map((registro) => registro.etapa)
    : CAMINHO_NORMAL.map((etapa) => (etapa === "faturado" && pedido.etapa === "faturado_parcial" ? "faturado_parcial" : etapa));
  const indiceAtual = caminho.indexOf(pedido.etapa);
  return caminho.map((etapa, indice) => ({
    etapa,
    estado: indice < indiceAtual ? "feito" : indice === indiceAtual ? "atual" : "futuro",
    em: quando.get(etapa) ?? null,
  }));
}

/**
 * O status do pedido enviado pelo CRM no histórico da ficha: "enviado" até chegar ao ERP e, de lá em
 * diante, o de um pedido do ERP. Recusado e cancelado não viraram pedido e ficam fora (null).
 */
export const STATUS_NA_FICHA: Record<EtapaDoPedido, StatusDoPedido | null> = {
  enviado: "enviado",
  recebido: "enviado",
  em_aprovacao: "enviado",
  aprovado: "enviado",
  no_erp: "em_aberto",
  faturado_parcial: "em_aberto",
  faturado: "faturado",
  recusado: null,
  cancelado: null,
};

/**
 * O que impede o envio, em frases para o representante; lista vazia quando dá para enviar.
 * `hoje` é a data do relógio de Brasília, nunca a da foto: com a foto atrasada, uma entrega cedo demais passaria.
 */
export function problemasDoPedido(linhas: readonly LinhaDoPedido[], observacao: string, entrega: string | null, hoje: string): string[] {
  const problemas: string[] = [];
  const primeiraEntrega = primeiraEntregaPossivel(hoje);
  if (!linhas.some((linha) => linha.quantidade > 0)) problemas.push("Inclua pelo menos um produto.");
  if (entrega !== null && entrega < primeiraEntrega) {
    problemas.push(`A entrega desejada precisa ser a partir de ${formatarData(primeiraEntrega)}: ${DIAS_UTEIS_ATE_A_ENTREGA} dias úteis depois de hoje.`);
  }
  if (observacao.length > LIMITE_DA_OBSERVACAO) problemas.push(`A observação passa de ${LIMITE_DA_OBSERVACAO} caracteres.`);
  return problemas;
}

/**
 * O id de um rascunho novo: um UUID versão 4, o formato que o servidor aceita. Sai de
 * crypto.getRandomValues, e não de crypto.randomUUID, que o navegador só tem em endereço seguro (HTTPS
 * ou localhost): no protótipo aberto pelo IP da rede interna, a tela do pedido ficava em branco.
 */
export function novoIdDeRascunho(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // Os bits que marcam a versão 4 e a variante do padrão (RFC 9562).
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
