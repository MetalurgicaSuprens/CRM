import { describe, expect, it } from "vitest";
import type { CondicoesNoSgi, ReferenciasDoItemNoSgi } from "../erp/tipos.ts";
import { montarCondicoesDosPedidos } from "./condicoesDosPedidos.ts";

function condicoes(mudancas: Partial<CondicoesNoSgi> = {}): CondicoesNoSgi {
  return {
    pedido: "1149882",
    cliente: 4321,
    transportadora: "46576350007",
    condicaoDePagamento: "1002",
    tipoDeEntrega: "PROGRAMADA",
    entrega: "2026-12-04",
    ordemDeCompra: " 4500123987 ",
    classificacao: "USO/CONSUMO",
    freteParcial: "NAO ACEITA FRETE PARCIAL",
    pagamentoDoFrete: "T",
    observacao: "Entregar na doca 3.",
    ...mudancas,
  };
}

function item(mudancas: Partial<ReferenciasDoItemNoSgi> = {}): ReferenciasDoItemNoSgi {
  return { pedido: "1149882", produto: "CRIF1422", partNumber: "CF420118", ordemDeCompra: null, itemDaOrdemDeCompra: 1, ...mudancas };
}

const DA_FOTO = [{ pedido: "1149882", chave: "1/4321" }];

describe("montarCondicoesDosPedidos", () => {
  it("traduz o cabeçalho do SGI para a foto", () => {
    expect(montarCondicoesDosPedidos({ condicoes: [condicoes()], itens: [] }, DA_FOTO).pedido_condicoes).toEqual([
      {
        pedido: "1149882",
        transportadora: "46576350007",
        condicao_pagamento: "1002",
        tipo_entrega: "programada",
        entrega: "2026-12-04",
        ordem_de_compra: "4500123987",
        classificacao: "uso_consumo",
        aceita_parcial: 0,
        pagamento_frete: "T",
        observacao: "Entregar na doca 3.",
      },
    ]);
  });

  it("aceita o frete parcial e trata o vazio e o desconhecido como sem", () => {
    const [linha] = montarCondicoesDosPedidos(
      { condicoes: [condicoes({ freteParcial: "ACEITA FRETE PARCIAL", ordemDeCompra: "0", pagamentoDoFrete: "X", tipoDeEntrega: null, observacao: "  " })], itens: [] },
      DA_FOTO,
    ).pedido_condicoes;
    expect(linha).toMatchObject({ aceita_parcial: 1, ordem_de_compra: null, pagamento_frete: null, tipo_entrega: null, observacao: null });
  });

  it("ignora o pedido do SGI de outro cliente, com o mesmo número, e os itens dele", () => {
    const tabelas = montarCondicoesDosPedidos({ condicoes: [condicoes({ cliente: 9999 })], itens: [item()] }, DA_FOTO);
    expect(tabelas).toEqual({ pedido_condicoes: [], pedido_item_referencia: [] });
  });

  it("ignora o pedido que a foto não mostra", () => {
    expect(montarCondicoesDosPedidos({ condicoes: [condicoes({ pedido: "1" })], itens: [] }, DA_FOTO).pedido_condicoes).toEqual([]);
  });

  it("guarda as referências de cada produto, da primeira linha que tem alguma, e pula o item sem nenhuma", () => {
    const itens = [
      item({ produto: "SEM", partNumber: "0", itemDaOrdemDeCompra: null }),
      item({ ordemDeCompra: "OC-77" }),
      item({ partNumber: "OUTRO", itemDaOrdemDeCompra: 2 }),
    ];
    expect(montarCondicoesDosPedidos({ condicoes: [condicoes()], itens }, DA_FOTO).pedido_item_referencia).toEqual([
      { pedido: "1149882", produto: "CRIF1422", part_number: "CF420118", ordem_de_compra: "OC-77", item_da_ordem_de_compra: 1 },
    ]);
  });
});
