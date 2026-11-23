import type { Foto } from "dominio/esquemaDaFoto";
import type { PedidoDoCrmNaLan } from "../pedidos/andamento.ts";

/*
 * A etapa de cada pedido do CRM, para a tela de andamento (web/src/dados/pedido.ts, passosDoAndamento):
 * - na LAN: recebido, ou recusado com o motivo;
 * - no SGI, pelo PV1_STA: COTACAO e PEDIDO BLOQUEADO esperam as liberações (em aprovação), PEDIDO foi
 *   liberado (aprovado), PEDIDO OMEGA está no ERP e o cancelado acaba ali;
 * - no Omega, pelo número do pedido: com saldo em aberto e nota, faturado em parte; sem saldo, faturado.
 * Os passos levam a hora que a LAN conhece: a do recebimento, a da recusa e a da gravação no SGI. Dos
 * passos seguintes, a LAN não sabe a hora.
 */

export type PedidosDoErp = {
  /** Os pedidos do Omega com saldo a faturar (pedido_aberto). */
  emAberto: ReadonlySet<string>;
  /** Os pedidos do Omega com nota de venda no período da foto (pedido_faturado). */
  comNota: ReadonlySet<string>;
};

type Passo = { etapa: string; em: string | null };

export function montarPedidosDoCrm(pedidos: readonly PedidoDoCrmNaLan[], erp: PedidosDoErp): Foto["pedido_crm"] {
  return pedidos.map((pedido) => {
    const recebido: Passo = { etapa: "recebido", em: pedido.recebidoEm };
    const linha = { numero: pedido.numero, numero_sgi: null, numero_erp: null, total_sgi: null, motivo_recusa: null };
    if (pedido.situacao === "recebido") return { ...linha, etapa: "recebido", historico: JSON.stringify([recebido]) };
    if (pedido.situacao === "recusado") {
      return { ...linha, etapa: "recusado", motivo_recusa: pedido.motivo, historico: JSON.stringify([recebido, { etapa: "recusado", em: pedido.recusadoEm }]) };
    }
    const numeroSgi = String(pedido.numeroSgi);
    const etapa = etapaNoSgi(pedido.statusNoSgi, numeroSgi, erp);
    const passos: Passo[] = [recebido, { etapa: "em_aprovacao", em: pedido.gravadoEm }];
    if (etapa === "cancelado") passos.push({ etapa: "cancelado", em: null });
    return {
      ...linha,
      etapa,
      numero_sgi: numeroSgi,
      numero_erp: ["no_erp", "faturado_parcial", "faturado"].includes(etapa) ? numeroSgi : null,
      total_sgi: pedido.totalNoSgi,
      historico: JSON.stringify(passos),
    };
  });
}

/**
 * O pedido gravado que não está mais no SGI foi excluído lá: a tela de pedidos do SGI não cancela, só
 * exclui. A gravação só o marca como gravado depois de confirmar a transação, então ele chegou a existir.
 */
function etapaNoSgi(status: string | null, numero: string, { emAberto, comNota }: PedidosDoErp): string {
  if (status === null) return "cancelado";
  if (status === "COTACAO" || status === "PEDIDO BLOQUEADO") return "em_aprovacao";
  if (status === "PEDIDO") return "aprovado";
  if (status.startsWith("CANCELAD")) return "cancelado";
  if (status !== "PEDIDO OMEGA") return "em_aprovacao";
  if (!emAberto.has(numero)) return "faturado";
  return comNota.has(numero) ? "faturado_parcial" : "no_erp";
}
