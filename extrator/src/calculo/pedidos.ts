import type { Foto } from "dominio/esquemaDaFoto";
import type { ItemDaNota, ItemEmAbertoNoErp, NotaRecente, PedidoEmAbertoNoErp, PedidoFaturadoNoErp } from "../erp/tipos.ts";
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

export type TabelasDosPedidosFaturados = Pick<Foto, "pedido_faturado" | "pedido_faturado_item">;

/**
 * O histórico de pedidos da ficha, com os itens que a linha mostra ao abrir. O pedido que ainda tem
 * saldo, de qualquer representante, é "em aberto" e fica só em `pedido_aberto`; o de cliente fora da
 * carteira dos autorizados não aparece em ficha nenhuma e não entra.
 */
export function montarPedidosFaturados(
  faturados: readonly PedidoFaturadoNoErp[],
  emAberto: readonly PedidoEmAbertoNoErp[],
  idDoCliente: (chave: string) => string | null,
): TabelasDosPedidosFaturados {
  const comSaldo = new Set(emAberto.map((pedido) => pedido.pedido));
  const daFicha = faturados.flatMap((pedido) => {
    const cliente = idDoCliente(pedido.chave);
    return cliente && !comSaldo.has(pedido.pedido) ? [{ ...pedido, cliente, itens: somarPorProduto(pedido.itens) }] : [];
  });
  return {
    pedido_faturado: daFicha.map(({ pedido, representante, cliente, emissao, faturadoEm, itens }) => ({
      pedido,
      representante,
      cliente,
      emissao,
      faturado_em: faturadoEm,
      itens: itens.length,
      valor: somarValores(itens),
    })),
    pedido_faturado_item: daFicha.flatMap(({ pedido, itens }) =>
      itens.map(({ produto, pecas, valor }, i) => ({ pedido, ordem: i + 1, produto, pecas, valor })),
    ),
  };
}

/** O mesmo produto em mais de uma nota do pedido vira um item só, na posição da primeira vez. */
function somarPorProduto(itens: readonly ItemDaNota[]): ItemDaNota[] {
  const porProduto = new Map<string, ItemDaNota>();
  for (const item of itens) {
    const soma = porProduto.get(item.produto);
    porProduto.set(item.produto, soma ? { ...soma, pecas: soma.pecas + item.pecas, valor: soma.valor + item.valor } : item);
  }
  return [...porProduto.values()];
}

function somarValores(itens: readonly { valor: number }[]): number {
  return itens.reduce((soma, item) => soma + item.valor, 0);
}
