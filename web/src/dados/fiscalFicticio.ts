import { criarAleatorio } from "./aleatorio";
import { transportadorasFicticias } from "./dadosDoPedidoFicticio";
import type { Cfop } from "./tipos";

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

function centavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}
