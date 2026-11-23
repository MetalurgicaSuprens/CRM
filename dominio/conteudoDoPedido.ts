/*
 * O conteúdo do pedido enviado em forma canônica, igual no servidor e na LAN: é sobre este texto que se
 * calcula o sha256 que o servidor põe no desafio da chave de acesso (server/src/envio/pedidosEnviados.ts)
 * e no arquivo da caixa de saída. A máquina do extrator o calcula de novo e só aceita o pedido cujo
 * conteúdo é o que o representante confirmou. Os campos entram sempre na mesma ordem, venha o JSON na
 * ordem que vier. O hash fica com quem usa: o domínio também roda no navegador, sem node:crypto.
 */

import type { OrdemDeCompraDoItem } from "./pedido.ts";

export type TransportadoraDoPedido = { codigo: string } | { nova: { cnpj: string; nome: string; cidade: string; uf: string } } | null;

export type ConteudoDoPedido = {
  /** O id opaco do cliente na foto. */
  cliente: string;
  itens: readonly ({ codigo: string; quantidade: number; precoCento: number } & OrdemDeCompraDoItem)[];
  entrega: string | null;
  observacao: string;
  escolhas: {
    condicaoDePagamento: string;
    classificacao: string;
    pedidoDoCliente: string;
    aceitaParcial: boolean;
    clienteXped: boolean;
    transportadora: TransportadoraDoPedido;
  };
};

export function conteudoCanonico({ cliente, itens, entrega, observacao, escolhas }: ConteudoDoPedido): string {
  const { condicaoDePagamento, classificacao, pedidoDoCliente, aceitaParcial, clienteXped, transportadora } = escolhas;
  return JSON.stringify({
    cliente,
    itens: itens.map(({ codigo, quantidade, precoCento, ordemDeCompra, itemDaOrdemDeCompra }) => ({ codigo, quantidade, precoCento, ordemDeCompra, itemDaOrdemDeCompra })),
    entrega,
    observacao,
    escolhas: { condicaoDePagamento, classificacao, pedidoDoCliente, aceitaParcial, clienteXped, transportadora: transportadoraEmOrdem(transportadora) },
  });
}

function transportadoraEmOrdem(transportadora: TransportadoraDoPedido): TransportadoraDoPedido {
  if (transportadora === null || "codigo" in transportadora) return transportadora && { codigo: transportadora.codigo };
  const { cnpj, nome, cidade, uf } = transportadora.nova;
  return { nova: { cnpj, nome, cidade, uf } };
}
