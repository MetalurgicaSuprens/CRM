/*
 * As contas do valor do pedido, iguais na tela e no servidor (o total do rascunho): o valor de cada
 * item e o total. A LAN revalida tudo no Oracle quando o pedido chega lá.
 */

/** A única conversão de unidade do CRM: o ERP trabalha em CT, o cento de peças. */
export const PECAS_POR_CENTO = 100;

/** Caracteres da observação do pedido, que vai para o PV1_OBS do SGI. */
export const LIMITE_DA_OBSERVACAO = 300;

/** Um item com a quantidade em peças e o preço do cento. */
export type ItemComPreco = { quantidade: number; precoCento: number };

export function pecasEmCentos(pecas: number): number {
  return pecas / PECAS_POR_CENTO;
}

/** O valor do item, arredondado ao centavo: a tela mostra os centavos, e o total é a soma do que ela mostra. */
export function valorDaLinha(item: ItemComPreco): number {
  return arredondarAoCentavo(pecasEmCentos(item.quantidade) * item.precoCento);
}

/** A soma dos itens, já no centavo; arredondar de novo tira o resto que a soma em ponto flutuante deixa. */
export function totalDoPedido(itens: readonly ItemComPreco[]): number {
  return arredondarAoCentavo(itens.reduce((total, item) => total + valorDaLinha(item), 0));
}

export function arredondarAoCentavo(valor: number): number {
  return Math.round(valor * 100) / 100;
}
