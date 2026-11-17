import { describe, expect, it } from "vitest";
import type { ItemEmAbertoNoErp, NotaRecente, PedidoEmAbertoNoErp, PedidoFaturadoNoErp } from "../erp/tipos.ts";
import { montarPedidos, montarPedidosFaturados, resumirPedido } from "./pedidos.ts";
import { montarReferencia } from "./referencia.ts";

const REFERENCIA = montarReferencia("2026-10-13T09:50");

function item(produto: string, entrega: string, valor: number): ItemEmAbertoNoErp {
  return { produto, familia: "FLEXIL", pecas: 100, entrega, valor, ipi: valor * 0.05 };
}

describe("resumirPedido", () => {
  const itens = [item("A", "2026-11-04", 1_000), item("B", "2026-09-30", 300), item("C", "2026-10-31", 200)];

  it("dá à lista a entrega mais próxima entre os itens com saldo", () => {
    expect(resumirPedido(itens, REFERENCIA.fimDoMesAtual).entrega).toBe("2026-09-30");
  });

  it("soma os itens e, para a projeção, só os com entrega até o fim do mês, inclusive os atrasados", () => {
    expect(resumirPedido(itens, REFERENCIA.fimDoMesAtual)).toMatchObject({ valor: 1_500, valorEntregaNoMes: 500 });
  });

  it("recusa pedido sem item, que não vem do ERP", () => {
    expect(() => resumirPedido([], REFERENCIA.fimDoMesAtual)).toThrow();
  });
});

describe("montarPedidos", () => {
  const pedido: PedidoEmAbertoNoErp = {
    pedido: "1801234",
    chave: "1/123",
    representante: "1401",
    emissao: "2026-10-01",
    cfop: { codigo: "6401", descricao: "VENDA PROD SUJEITA A SUBS TRIBUTARIA" },
    // O mesmo produto em duas entregas: duas linhas.
    itens: [item("A", "2026-10-20", 1_000), item("A", "2026-11-20", 400)],
  };
  const nota: NotaRecente = {
    nota: "180001",
    serie: "1",
    chave: "1/456",
    representante: "1401",
    emissao: "2026-10-05",
    valorTotal: 1_250,
    transportadora: { codigo: "78499999", fantasia: null, razaoSocial: "SUPRENS RETIRA" },
    cfop: { codigo: "5101", descricao: "VENDA DE PRODUCAO DO ESTABELECIMENTO" },
    pedidos: ["1801200"],
    itens: [
      { produto: "B", familia: null, pecas: 200, valor: 700, ipi: 35 },
      { produto: "C", familia: "MICRO", pecas: 100, valor: 300, ipi: 15 },
    ],
  };
  const tabelas = montarPedidos({ pedidos: [pedido], notas: [nota] }, REFERENCIA, (chave) => (chave === "1/123" ? "id-do-cliente" : null));

  it("grava o pedido com o resumo dos itens, o IPI do saldo e o CFOP, e cada item na ordem do pedido", () => {
    expect(tabelas.pedido_aberto).toEqual([
      {
        pedido: "1801234",
        representante: "1401",
        cliente: "id-do-cliente",
        emissao: "2026-10-01",
        entrega: "2026-10-20",
        itens: 2,
        valor: 1_400,
        valor_ipi: 70,
        valor_entrega_no_mes: 1_000,
        cfop: "6401",
        cfop_descricao: "VENDA PROD SUJEITA A SUBS TRIBUTARIA",
      },
    ]);
    expect(tabelas.pedido_aberto_item.map(({ ordem, entrega }) => [ordem, entrega])).toEqual([
      [1, "2026-10-20"],
      [2, "2026-11-20"],
    ]);
  });

  it("grava a nota com a soma dos itens, o IPI, o total, a transportadora, o CFOP e os pedidos de origem, e o cliente de fora da carteira nulo", () => {
    expect(tabelas.nota).toEqual([
      {
        nota: "180001",
        serie: "1",
        representante: "1401",
        cliente: null,
        emissao: "2026-10-05",
        valor: 1_000,
        valor_ipi: 50,
        valor_total: 1_250,
        transportadora: "Cliente retira",
        cfop: "5101",
        cfop_descricao: "VENDA DE PRODUCAO DO ESTABELECIMENTO",
        pedidos: '["1801200"]',
      },
    ]);
    expect(tabelas.nota_item).toEqual([
      { nota: "180001", serie: "1", ordem: 1, produto: "B", pecas: 200, valor: 700 },
      { nota: "180001", serie: "1", ordem: 2, produto: "C", pecas: 100, valor: 300 },
    ]);
  });
});

describe("montarPedidosFaturados", () => {
  function faturado(pedido: string, chave: string): PedidoFaturadoNoErp {
    return {
      pedido,
      chave,
      representante: "1401",
      emissao: "2026-09-02",
      faturadoEm: "2026-09-10",
      cfop: { codigo: "6101", descricao: null },
      // Duas notas: o produto A veio nas duas.
      notas: [
        { numero: "180010", serie: "1", emissao: "2026-09-05", valorTotal: 3_800, transportadora: { codigo: "100", fantasia: "RODONAVES", razaoSocial: "RTE RODONAVES LTDA" } },
        { numero: "180020", serie: "1", emissao: "2026-09-10", valorTotal: 1_050, transportadora: null },
      ],
      itens: [
        { produto: "A", familia: "FLEXIL", pecas: 1_000, valor: 2_000, ipi: 100 },
        { produto: "B", familia: "PRESIL", pecas: 200, valor: 1_500, ipi: 75 },
        { produto: "A", familia: "FLEXIL", pecas: 500, valor: 1_000, ipi: 50 },
      ],
    };
  }
  const emAberto: PedidoEmAbertoNoErp = { pedido: "1801234", chave: "1/123", representante: "9999", emissao: "2026-09-01", cfop: null, itens: [item("A", "2026-10-20", 1_000)] };
  const idDoCliente = (chave: string) => (chave === "1/123" ? "id-do-cliente" : null);

  it("grava o pedido faturado com o id do cliente, os produtos, a soma das notas, o IPI e o CFOP", () => {
    expect(montarPedidosFaturados([faturado("1801000", "1/123")], [], idDoCliente).pedido_faturado).toMatchObject([
      {
        pedido: "1801000",
        representante: "1401",
        cliente: "id-do-cliente",
        emissao: "2026-09-02",
        faturado_em: "2026-09-10",
        itens: 2,
        valor: 4_500,
        valor_ipi: 225,
        cfop: "6101",
        cfop_descricao: null,
      },
    ]);
  });

  it("grava as notas do pedido com o número, a emissão, o total e o nome da transportadora", () => {
    const [pedido] = montarPedidosFaturados([faturado("1801000", "1/123")], [], idDoCliente).pedido_faturado;
    expect(JSON.parse(pedido?.notas ?? "[]")).toEqual([
      { numero: "180010", emissao: "2026-09-05", valor_total: 3_800, transportadora: "RODONAVES" },
      { numero: "180020", emissao: "2026-09-10", valor_total: 1_050, transportadora: null },
    ]);
  });

  it("soma o produto que veio em mais de uma nota num item só, na posição da primeira vez", () => {
    expect(montarPedidosFaturados([faturado("1801000", "1/123")], [], idDoCliente).pedido_faturado_item).toEqual([
      { pedido: "1801000", ordem: 1, produto: "A", pecas: 1_500, valor: 3_000 },
      { pedido: "1801000", ordem: 2, produto: "B", pecas: 200, valor: 1_500 },
    ]);
  });

  it("deixa de fora o pedido que ainda tem saldo, de qualquer representante: ele é o em aberto", () => {
    expect(montarPedidosFaturados([faturado("1801234", "1/123")], [emAberto], idDoCliente)).toEqual({ pedido_faturado: [], pedido_faturado_item: [] });
  });

  it("deixa de fora o pedido de cliente fora da carteira dos autorizados, que nenhuma ficha mostra", () => {
    expect(montarPedidosFaturados([faturado("1801000", "1/999")], [], idDoCliente)).toEqual({ pedido_faturado: [], pedido_faturado_item: [] });
  });
});
