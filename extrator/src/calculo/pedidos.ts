import type { Foto } from "dominio/esquemaDaFoto";
import type { ItemEmAbertoNoErp, NotaRecente, PedidoEmAbertoNoErp, PedidoFaturadoNoErp } from "../erp/tipos.ts";
import type { Referencia } from "./referencia.ts";

/*
 * Pedidos em aberto e notas dos representantes autorizados, cada um com os itens que a linha da
 * aba Pedidos mostra ao abrir. O cliente vai pelo id quando está na carteira de um autorizado, e
 * nulo nos outros casos.
 */

export type TabelasDosPedidos = Pick<Foto, "pedido_aberto" | "pedido_aberto_item" | "nota" | "nota_item">;

export type ResumoDoPedido = {
  /** A entrega mais próxima entre os itens com saldo: a da lista. */
  entrega: string;
  valor: number;
  /** Parte do valor com entrega até o fim do mês corrente, inclusive a atrasada: o piso da projeção. */
  valorEntregaNoMes: number;
};

export function resumirPedido(itens: readonly ItemEmAbertoNoErp[], fimDoMes: string): ResumoDoPedido {
  const [primeiro, ...demais] = itens;
  if (!primeiro) throw new Error("Pedido em aberto sem item com saldo.");
  return {
    entrega: demais.reduce((maisProxima, item) => (item.entrega < maisProxima ? item.entrega : maisProxima), primeiro.entrega),
    valor: somarValores(itens),
    valorEntregaNoMes: somarValores(itens.filter((item) => item.entrega <= fimDoMes)),
  };
}

export function montarPedidos(
  { pedidos, notas }: { pedidos: readonly PedidoEmAbertoNoErp[]; notas: readonly NotaRecente[] },
  referencia: Referencia,
  idDoCliente: (chave: string) => string | null,
): TabelasDosPedidos {
  return {
    pedido_aberto: pedidos.map((pedido) => {
      const { entrega, valor, valorEntregaNoMes } = resumirPedido(pedido.itens, referencia.fimDoMesAtual);
      return {
        pedido: pedido.pedido,
        representante: pedido.representante,
        cliente: idDoCliente(pedido.chave),
        emissao: pedido.emissao,
        entrega,
        itens: pedido.itens.length,
        valor,
        valor_entrega_no_mes: valorEntregaNoMes,
      };
    }),
    pedido_aberto_item: pedidos.flatMap(({ pedido, itens }) =>
      itens.map(({ produto, pecas, entrega, valor }, i) => ({ pedido, ordem: i + 1, produto, pecas, entrega, valor })),
    ),
    nota: notas.map((nota) => ({
      nota: nota.nota,
      serie: nota.serie,
      representante: nota.representante,
      cliente: idDoCliente(nota.chave),
      emissao: nota.emissao,
      valor: somarValores(nota.itens),
      pedidos: JSON.stringify(nota.pedidos),
    })),
    nota_item: notas.flatMap(({ nota, serie, itens }) =>
      itens.map(({ produto, pecas, valor }, i) => ({ nota, serie, ordem: i + 1, produto, pecas, valor })),
    ),
  };
}

/**
 * O histórico de pedidos da ficha. O pedido que ainda tem saldo, de qualquer representante, é "em
 * aberto" e fica só em `pedido_aberto`; o de cliente fora da carteira dos autorizados não aparece em
 * ficha nenhuma e não entra.
 */
export function montarPedidosFaturados(
  faturados: readonly PedidoFaturadoNoErp[],
  emAberto: readonly PedidoEmAbertoNoErp[],
  idDoCliente: (chave: string) => string | null,
): Foto["pedido_faturado"] {
  const comSaldo = new Set(emAberto.map((pedido) => pedido.pedido));
  return faturados.flatMap(({ pedido, chave, representante, emissao, faturadoEm, itens, valor }) => {
    const cliente = idDoCliente(chave);
    if (!cliente || comSaldo.has(pedido)) return [];
    return [{ pedido, representante, cliente, emissao, faturado_em: faturadoEm, itens, valor }];
  });
}

function somarValores(itens: readonly { valor: number }[]): number {
  return itens.reduce((soma, item) => soma + item.valor, 0);
}
