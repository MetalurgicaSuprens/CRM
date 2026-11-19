import { somarDiasUteis } from "./calendario.ts";

/*
 * As regras do pedido iguais na tela e no servidor: o valor de cada item, o total (o do rascunho, no
 * servidor) e a primeira entrega desejada que o pedido aceita. A LAN revalida tudo no Oracle quando o
 * pedido chega lá.
 */

/** A única conversão de unidade do CRM: o ERP trabalha em CT, o cento de peças. */
export const PECAS_POR_CENTO = 100;

/** Caracteres da observação do pedido, que vai para o PV1_OBS do SGI. */
export const LIMITE_DA_OBSERVACAO = 300;

/** A entrega desejada fica a pelo menos 5 dias úteis de hoje (pedido do Lucas em 2026-11-05). */
export const DIAS_UTEIS_ATE_A_ENTREGA = 5;

/** Caracteres da ordem de compra do cliente, no pedido (PV1_OCO) e no item (PV2_OCO). */
export const LIMITE_DA_ORDEM_DE_COMPRA = 30;

/** O maior número de item da ordem de compra: a nota fiscal eletrônica leva até 6 algarismos (nItemPed). */
export const MAIOR_ITEM_DA_ORDEM_DE_COMPRA = 999_999;

/**
 * A ordem de compra do cliente em cada item, como no app antigo dos representantes (SGI6R, "Ordem
 * Compra:" e "Item O.C.:" na inclusão do item). Os clientes que pedem o xPed na nota fiscal querem nela
 * o número do pedido deles e o item correspondente.
 * - ordemDeCompra: null é a do pedido (pedidoDoCliente), como o SGI6R preenche;
 * - itemDaOrdemDeCompra: null é sem item, que o SGI6R grava como 0.
 */
export type OrdemDeCompraDoItem = { ordemDeCompra: string | null; itemDaOrdemDeCompra: number | null };

/** "CRM-00106": o número que o CRM dá ao pedido enviado, que o SGI guarda para ligar o pedido dele ao do CRM. */
export function numeroDoPedidoCrm(numero: number): string {
  return `CRM-${String(numero).padStart(5, "0")}`;
}

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

/** A primeira data que a entrega desejada aceita. `hoje` é a data do relógio de Brasília, nunca a da foto. */
export function primeiraEntregaPossivel(hoje: string): string {
  return somarDiasUteis(hoje, DIAS_UTEIS_ATE_A_ENTREGA);
}
