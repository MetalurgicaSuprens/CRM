import { describe, expect, it } from "vitest";
import { conteudoCanonico, type ConteudoDoPedido } from "./conteudoDoPedido.ts";

const PEDIDO: ConteudoDoPedido = {
  cliente: "aaaaaaaaaaaaaaa1",
  itens: [{ codigo: "F-100", quantidade: 300, precoCento: 98.4 }],
  entrega: null,
  observacao: "",
  escolhas: { condicaoDePagamento: "1030", classificacao: "industrializacao", pedidoDoCliente: "OC 4512", aceitaParcial: true, transportadora: { codigo: "101" } },
};

describe("conteudoCanonico", () => {
  it("fica igual com os campos em outra ordem", () => {
    const { escolhas } = PEDIDO;
    const reordenado = {
      escolhas: { transportadora: escolhas.transportadora, aceitaParcial: true, pedidoDoCliente: "OC 4512", classificacao: "industrializacao", condicaoDePagamento: "1030" },
      observacao: "",
      entrega: null,
      itens: [{ precoCento: 98.4, quantidade: 300, codigo: "F-100" }],
      cliente: PEDIDO.cliente,
    };
    expect(conteudoCanonico(reordenado)).toBe(conteudoCanonico(PEDIDO));
  });

  it("muda com qualquer mudança no pedido", () => {
    const canonico = conteudoCanonico(PEDIDO);
    expect(conteudoCanonico({ ...PEDIDO, itens: [{ codigo: "F-100", quantidade: 301, precoCento: 98.4 }] })).not.toBe(canonico);
    expect(conteudoCanonico({ ...PEDIDO, escolhas: { ...PEDIDO.escolhas, transportadora: { codigo: "102" } } })).not.toBe(canonico);
    expect(conteudoCanonico({ ...PEDIDO, observacao: " " })).not.toBe(canonico);
  });
});
