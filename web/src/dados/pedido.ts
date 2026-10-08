import type { EtapaDoPedido, PedidoEnviado } from "./tipos";

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

export function totalDoPedido(linhas: readonly LinhaDoPedido[]): number {
  return linhas.reduce((total, linha) => total + valorDaLinha(linha), 0);
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

/** O que impede o envio, em frases para o representante; lista vazia quando dá para enviar. */
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
