import { describe, expect, it } from "vitest";
import type { ItemEmAbertoNoErp, NotaRecente, PedidoEmAbertoNoErp, PedidoFaturadoNoErp } from "../erp/tipos.ts";
import { montarPedidos, montarPedidosFaturados, resumirPedido } from "./pedidos.ts";
import { montarReferencia } from "./referencia.ts";

const REFERENCIA = montarReferencia("2026-10-13T09:50");

function item(produto: string, entrega: string, valor: number): ItemEmAbertoNoErp {
  return { produto, familia: "FLEXIL", pecas: 100, entrega, valor };
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
    // O mesmo produto em duas entregas: duas linhas.
    itens: [item("A", "2026-10-20", 1_000), item("A", "2026-11-20", 400)],
  };
  const nota: NotaRecente = {
    nota: "180001",
    serie: "1",
    chave: "1/456",
    representante: "1401",
    emissao: "2026-10-05",
    pedidos: ["1801200"],
    itens: [
      { produto: "B", familia: null, pecas: 200, valor: 700 },
      { produto: "C", familia: "MICRO", pecas: 100, valor: 300 },
    ],
  };
  const tabelas = montarPedidos({ pedidos: [pedido], notas: [nota] }, REFERENCIA, (chave) => (chave === "1/123" ? "id-do-cliente" : null));

  it("grava o pedido com o resumo dos itens e cada item na ordem do pedido", () => {
    expect(tabelas.pedido_aberto).toEqual([
      {
        pedido: "1801234",
        representante: "1401",
        cliente: "id-do-cliente",
        emissao: "2026-10-01",
        entrega: "2026-10-20",
        itens: 2,
        valor: 1_400,
        valor_entrega_no_mes: 1_000,
      },
    ]);
    expect(tabelas.pedido_aberto_item.map(({ ordem, entrega }) => [ordem, entrega])).toEqual([
      [1, "2026-10-20"],
      [2, "2026-11-20"],
    ]);
  });

  it("grava a nota com a soma dos itens e os pedidos de origem, e o cliente de fora da carteira nulo", () => {
    expect(tabelas.nota).toEqual([
      { nota: "180001", serie: "1", representante: "1401", cliente: null, emissao: "2026-10-05", valor: 1_000, pedidos: '["1801200"]' },
    ]);
    expect(tabelas.nota_item).toEqual([
      { nota: "180001", serie: "1", ordem: 1, produto: "B", pecas: 200, valor: 700 },
      { nota: "180001", serie: "1", ordem: 2, produto: "C", pecas: 100, valor: 300 },
    ]);
  });
});

describe("montarPedidosFaturados", () => {
  function faturado(pedido: string, chave: string): PedidoFaturadoNoErp {
    return { pedido, chave, representante: "1401", emissao: "2026-09-02", faturadoEm: "2026-09-10", itens: 3, valor: 4_500 };
  }
  const emAberto: PedidoEmAbertoNoErp = { pedido: "1801234", chave: "1/123", representante: "9999", emissao: "2026-09-01", itens: [item("A", "2026-10-20", 1_000)] };
  const idDoCliente = (chave: string) => (chave === "1/123" ? "id-do-cliente" : null);

  it("grava o pedido faturado com o id do cliente", () => {
    expect(montarPedidosFaturados([faturado("1801000", "1/123")], [], idDoCliente)).toEqual([
      { pedido: "1801000", representante: "1401", cliente: "id-do-cliente", emissao: "2026-09-02", faturado_em: "2026-09-10", itens: 3, valor: 4_500 },
    ]);
  });

  it("deixa de fora o pedido que ainda tem saldo, de qualquer representante: ele é o em aberto", () => {
    expect(montarPedidosFaturados([faturado("1801234", "1/123")], [emAberto], idDoCliente)).toEqual([]);
  });

  it("deixa de fora o pedido de cliente fora da carteira dos autorizados, que nenhuma ficha mostra", () => {
    expect(montarPedidosFaturados([faturado("1801000", "1/999")], [], idDoCliente)).toEqual([]);
  });
});
