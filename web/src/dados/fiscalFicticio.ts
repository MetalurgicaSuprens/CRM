import { criarAleatorio } from "./aleatorio";
import { CONDICOES_FICTICIAS, transportadorasFicticias } from "./dadosDoPedidoFicticio";
import type { Cfop, CondicoesDoPedidoNoErp, ItemDoErp, PagamentoDoFrete } from "./tipos";

/*
 * O que a carteira fictícia mostra de fiscal nos pedidos e nas notas: o CFOP, o IPI e a transportadora,
 * sorteados pelo número do documento, para cada um continuar o mesmo a cada carga. Nenhum é real.
 */

/** Os CFOPs de venda que mais aparecem nos pedidos do ERP, com a descrição como ele a guarda. */
const CFOPS: readonly Cfop[] = [
  { codigo: "6101", descricao: "VENDA DE PRODUCAO DO ESTABELECIMENTO" },
  { codigo: "6401", descricao: "VENDA PROD SUJEITA A SUBS TRIBUTARIA" },
  { codigo: "5101", descricao: "VENDA DE PRODUCAO DO ESTABELECIMENTO" },
  { codigo: "5401", descricao: "VENDA PROD. SUJEITA  A SUBST. TRIBUTARIA" },
];

/** A alíquota da maior parte dos itens do ERP. */
const ALIQUOTA_DO_IPI = 0.05;
/** A substituição tributária, que só entra no total da nota com o CFOP 5401 ou 6401. */
const ALIQUOTA_DA_SUBSTITUICAO = 0.1;

export function cfopFicticio(numero: string): Cfop {
  return criarAleatorio(Number(numero) + 7).escolher(CFOPS);
}

export function ipiFicticio(valor: number): number {
  return centavos(valor * ALIQUOTA_DO_IPI);
}

/** O total da nota: o valor, o IPI e, nos CFOPs de substituição, o imposto dela. */
export function totalDaNotaFicticio(valor: number, cfop: Cfop): number {
  const substituicao = cfop.codigo.endsWith("401") ? valor * ALIQUOTA_DA_SUBSTITUICAO : 0;
  return centavos(valor + ipiFicticio(valor) + substituicao);
}

export function transportadoraFicticia(numero: string): string {
  return criarAleatorio(Number(numero) + 13).escolher(transportadorasFicticias()).nome;
}

/** O que o representante preencheu no pedido, como o SGI guarda: um pedido em três tem a ordem de compra do cliente. */
export function condicoesFicticias(numero: string, entrega: string): CondicoesDoPedidoNoErp {
  const aleatorio = criarAleatorio(Number(numero) + 17);
  const temOrdem = aleatorio.chance(1 / 3);
  const isProgramada = aleatorio.chance(0.15);
  return {
    numero,
    transportadora: aleatorio.escolher(transportadorasFicticias()),
    condicaoDePagamento: aleatorio.escolher(CONDICOES_FICTICIAS).descricao,
    tipoDeEntrega: isProgramada ? "programada" : "imediata",
    entrega: isProgramada ? entrega : null,
    ordemDeCompra: temOrdem ? `45001${aleatorio.inteiro(10_000, 99_999)}` : null,
    classificacao: aleatorio.escolher(["comercializacao", "comercializacao", "industrializacao", "uso_consumo"] as const),
    aceitaParcial: aleatorio.chance(0.15),
    pagamentoDoFrete: aleatorio.escolher<PagamentoDoFrete>(["T", "T", "T", "P"]),
    observacao: aleatorio.chance(0.3) ? "Mencionar o número do pedido na nota fiscal." : null,
    temItemDaOrdemDeCompra: temOrdem,
  };
}

/** Os itens com o part number de alguns e, no pedido com ordem de compra, o item dela. */
export function comReferenciasFicticias<T extends ItemDoErp>(itens: readonly T[], condicoes: CondicoesDoPedidoNoErp): T[] {
  const aleatorio = criarAleatorio(Number(condicoes.numero) + 19);
  return itens.map((item, i) => ({
    ...item,
    partNumber: aleatorio.chance(0.4) ? String(aleatorio.inteiro(1_000, 9_999)).padStart(5, "0") : null,
    itemDaOrdemDeCompra: condicoes.temItemDaOrdemDeCompra ? i + 1 : null,
  }));
}

function centavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}
