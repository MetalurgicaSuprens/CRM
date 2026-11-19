import { createHash } from "node:crypto";
import { conteudoCanonico } from "dominio/conteudoDoPedido";
import type { PedidoRecebido } from "./formato.ts";

/*
 * Para os testes dos pedidos: um pedido como o servidor do CRM grava na caixa de saída
 * (server/src/envio/caixaDeSaida.ts), com o hash certo do conteúdo.
 */

export const CLIENTE_DO_PEDIDO = "aaaaaaaaaaaaaaa1";

export function pedidoDeTeste(parcial: Partial<PedidoRecebido> = {}): PedidoRecebido {
  const pedido: PedidoRecebido = {
    versao: 1,
    numero: "CRM-00001",
    enviadoEm: "2026-11-18T10:00",
    usuario: "00b083ba6c1f4430",
    codigos: ["1401"],
    cliente: CLIENTE_DO_PEDIDO,
    itens: [{ codigo: "F-100", quantidade: 300, precoCento: 98.4, ordemDeCompra: null, itemDaOrdemDeCompra: null }],
    entrega: null,
    observacao: "",
    escolhas: { condicaoDePagamento: "1030", classificacao: "industrializacao", pedidoDoCliente: "OC 4512", aceitaParcial: true, transportadora: { codigo: "101" } },
    hash: "",
    ...parcial,
  };
  return { ...pedido, hash: parcial.hash ?? createHash("sha256").update(conteudoCanonico(pedido)).digest("hex") };
}
