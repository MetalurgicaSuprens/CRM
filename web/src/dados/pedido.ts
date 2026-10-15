import type { EtapaDoPedido, PedidoEnviado, StatusDoPedido } from "./tipos";

/*
 * Contas do pedido no CRM. São só estimativas para o representante: ao receber o pedido, o SGI
 * recalcula os preços pela tabela do cliente, e a LAN revalida tudo no Oracle.
 */

/** A única conversão de unidade do CRM: o ERP trabalha em CT, o cento de peças. */
export const PECAS_POR_CENTO = 100;

export const LIMITE_DA_OBSERVACAO = 300;

export type LinhaDoPedido = {
  codigo: string;
  /** Em peças. */
  quantidade: number;
  /** Peças por embalagem: o pedido anda de embalagem em embalagem. */
  embalagem: number;
  /** Preço do cento na tabela do cliente. */
  precoCento: number;
};

export function pecasEmCentos(pecas: number): number {
  return pecas / PECAS_POR_CENTO;
}

/** Arredonda para cima até fechar a embalagem; quantidade inválida ou zerada vira zero. */
export function ajustarAEmbalagem(quantidade: number, embalagem: number): number {
  if (!Number.isFinite(quantidade) || quantidade <= 0) return 0;
  return Math.ceil(quantidade / embalagem) * embalagem;
}

export function valorDaLinha(linha: Pick<LinhaDoPedido, "quantidade" | "precoCento">): number {
  return pecasEmCentos(linha.quantidade) * linha.precoCento;
}

/** O preço do cento que o item do ERP pagou: o caminho de volta de valorDaLinha. Sem peças, 0. */
export function precoDoCento(item: { pecas: number; valor: number }): number {
  return item.pecas > 0 ? item.valor / pecasEmCentos(item.pecas) : 0;
}

export function totalDoPedido(linhas: readonly LinhaDoPedido[]): number {
  return linhas.reduce((total, linha) => total + valorDaLinha(linha), 0);
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
 * `hoje` é a data do relógio de Brasília, nunca a da foto: com a foto atrasada, ontem passaria.
 */
export function problemasDoPedido(linhas: readonly LinhaDoPedido[], observacao: string, entrega: string | null, hoje: string): string[] {
  const problemas: string[] = [];
  if (!linhas.some((linha) => linha.quantidade > 0)) problemas.push("Inclua pelo menos um produto.");
  for (const linha of linhas) {
    if (linha.quantidade % linha.embalagem !== 0) {
      problemas.push(`${linha.codigo}: a quantidade precisa fechar embalagens de ${linha.embalagem} peças.`);
    }
  }
  if (entrega !== null && entrega < hoje) problemas.push("A entrega desejada não pode ser antes de hoje.");
  if (observacao.length > LIMITE_DA_OBSERVACAO) problemas.push(`A observação passa de ${LIMITE_DA_OBSERVACAO} caracteres.`);
  return problemas;
}
