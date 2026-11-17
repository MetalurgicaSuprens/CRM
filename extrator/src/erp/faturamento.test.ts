import { describe, expect, it } from "vitest";
import { montarReferencia } from "../calculo/referencia.ts";
import type { Linha, Oracle } from "../oracle.ts";
import { lerNotasRecentes, lerPedidosFaturados } from "./faturamento.ts";

const REFERENCIA = montarReferencia("2026-10-13T09:50");

/** Um Oracle que devolve as linhas dadas a qualquer consulta. */
function oracleCom(linhas: Linha[]): Oracle {
  return { consultar: async () => linhas, fechar: async () => {} };
}

/** Uma linha de item de nota, na ordem do SELECT de `lerNotasRecentes`. */
function linhaDaNota(produto: string, tipoDeMovimento: number, totalDoCabecalho: number): Linha {
  return [180001, "1", 1, 456, 1401, "2026-10-05", 1801200, produto, "FLEXIL", 100, 500, 25, tipoDeMovimento, totalDoCabecalho, 100, "RODONAVES", "RTE RODONAVES LTDA", 5101, "VENDA DE PRODUCAO DO ESTABELECIMENTO"];
}

describe("lerNotasRecentes: o cabeçalho da nota", () => {
  it("conta o total da nota uma vez, mesmo com o cabeçalho repetido em cada item", async () => {
    const [nota] = await lerNotasRecentes(oracleCom([linhaDaNota("A", 310, 1_050), linhaDaNota("B", 310, 1_050)]), REFERENCIA, ["1401"]);
    expect(nota).toMatchObject({ valorTotal: 1_050, cfop: { codigo: "5101", descricao: "VENDA DE PRODUCAO DO ESTABELECIMENTO" } });
    expect(nota?.transportadora).toEqual({ codigo: "100", fantasia: "RODONAVES", razaoSocial: "RTE RODONAVES LTDA" });
    expect(nota?.itens.map((item) => item.ipi)).toEqual([25, 25]);
  });

  it("soma o total de cada tipo de movimento da mesma nota", async () => {
    const [nota] = await lerNotasRecentes(oracleCom([linhaDaNota("A", 310, 1_000), linhaDaNota("B", 315, 400)]), REFERENCIA, ["1401"]);
    expect(nota?.valorTotal).toBe(1_400);
  });

  it("deixa sem transportadora e sem CFOP a nota que não tem", async () => {
    const linha = [...linhaDaNota("A", 310, 1_000)];
    linha.splice(14, 5, 0, null, null, 0, null);
    const [nota] = await lerNotasRecentes(oracleCom([linha]), REFERENCIA, ["1401"]);
    expect(nota).toMatchObject({ transportadora: null, cfop: null });
  });
});

/** Uma linha de item de nota de um pedido, na ordem do SELECT de `lerPedidosFaturados`. */
function linhaDoPedido(nota: number, emissao: string, totalDoCabecalho: number): Linha {
  return [1, 1801000, 123, 1401, "2026-09-02", emissao, "A", "FLEXIL", 100, 500, 25, nota, "1", 310, totalDoCabecalho, 0, null, null, 6101, null];
}

describe("lerPedidosFaturados: as notas do pedido", () => {
  it("lista cada nota do pedido uma vez, com o total do cabeçalho, na ordem em que vieram", async () => {
    const linhas = [linhaDoPedido(180010, "2026-09-05", 3_800), linhaDoPedido(180010, "2026-09-05", 3_800), linhaDoPedido(180020, "2026-09-10", 1_050)];
    const [pedido] = await lerPedidosFaturados(oracleCom(linhas), REFERENCIA, ["1401"]);
    expect(pedido?.notas).toEqual([
      { numero: "180010", serie: "1", emissao: "2026-09-05", valorTotal: 3_800, transportadora: null },
      { numero: "180020", serie: "1", emissao: "2026-09-10", valorTotal: 1_050, transportadora: null },
    ]);
    expect(pedido).toMatchObject({ faturadoEm: "2026-09-10", cfop: { codigo: "6101", descricao: null } });
  });
});
