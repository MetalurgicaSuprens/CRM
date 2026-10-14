import { describe, expect, it } from "vitest";
import { AVISO_DE_CLIENTE_NEGATIVO } from "dominio/clienteNegativo";
import { dataDoMomento } from "dominio/datas";
import {
  clientesFicticios,
  fichaFicticia,
  notasFaturadasFicticias,
  painelFicticio,
  pedidosNoErpFicticios,
  situacaoDosDadosFicticia,
} from "./ficticio";
import { fonteFicticia } from "./fonteFicticia";

// Contrato que o extrator (F2) também precisa cumprir: tendência, faturado e variação contam a mesma história.
describe("evolução do faturado em 12 meses, na lista de clientes", () => {
  const clientes = clientesFicticios();

  it("tem 13 pontos: o mês fechado de um ano atrás e os 12 seguintes", () => {
    for (const cliente of clientes) expect(cliente.evolucao12m).toHaveLength(13);
  });

  it("termina no faturado dos últimos 12 meses", () => {
    for (const cliente of clientes) expect(cliente.evolucao12m.at(-1)).toBe(cliente.faturamento12m);
  });

  it("dá a variação dividindo o último ponto pelo primeiro", () => {
    const comVariacao = clientes.filter((cliente) => cliente.variacao12m !== null);
    expect(comVariacao.length).toBeGreaterThan(0);
    for (const cliente of comVariacao) {
      const primeiro = cliente.evolucao12m[0] ?? Number.NaN;
      expect(cliente.variacao12m).toBeCloseTo(cliente.faturamento12m / primeiro - 1, 10);
    }
  });
});

describe("contrato das outras telas", () => {
  it("tira a foto uma vez: entre as consultas só o relógio anda", () => {
    const antes = situacaoDosDadosFicticia(new Date("2026-10-09T12:00:00Z"));
    const depois = situacaoDosDadosFicticia(new Date("2026-10-09T13:30:00Z"));
    expect(depois.atualizadoEm).toBe(antes.atualizadoEm);
    expect(depois.hoje).toBe(dataDoMomento(antes.atualizadoEm));
    expect([antes.relogio, depois.relogio]).toEqual(["2026-10-09T09:00", "2026-10-09T10:30"]);
  });

  it("manda a faturar como número só no mês corrente, para a tela reconhecê-lo mesmo com 0", () => {
    const { mesAtual, mensal } = painelFicticio();
    const comAFaturar = mensal.filter((mes) => mes.aFaturar !== null);
    expect(comAFaturar.map((mes) => mes.mes)).toEqual([mesAtual.mes]);
    expect(comAFaturar[0]?.aFaturar).toBe(mesAtual.aFaturarNoMes);
  });

  it("dá a cada nota faturada um id que não se repete", () => {
    const notas = notasFaturadasFicticias();
    expect(notas.length).toBeGreaterThan(0);
    expect(new Set(notas.map((nota) => nota.id)).size).toBe(notas.length);
  });

  it("abre cada pedido em aberto nos itens com saldo, que somam o valor dele e começam pela entrega dele", () => {
    const pedidos = pedidosNoErpFicticios();
    expect(pedidos.length).toBeGreaterThan(0);
    for (const pedido of pedidos) {
      expect(pedido.itensEmAberto).toHaveLength(pedido.itens);
      expect(somarValores(pedido.itensEmAberto)).toBe(pedido.valor);
      expect(pedido.itensEmAberto.map((item) => item.entrega).sort()[0]).toBe(pedido.entrega);
    }
  });

  it("abre cada nota nos itens dela, que somam o valor da nota", () => {
    for (const nota of notasFaturadasFicticias()) {
      expect(nota.itens.length).toBeGreaterThan(0);
      expect(somarValores(nota.itens)).toBe(nota.valor);
    }
  });

  it("mostra na ficha só o ano da primeira compra, que não passa do ano da última", () => {
    for (const cliente of clientesFicticios()) {
      const ficha = fichaFicticia(cliente.codigo);
      if (!ficha?.ultimaCompra) continue;
      expect(ficha.clienteDesde).toBeLessThanOrEqual(Number(ficha.ultimaCompra.slice(0, 4)));
    }
  });
});

describe("cliente negativo na carteira", () => {
  it("existe no fictício, para a tela ter exemplo do selo", () => {
    expect(clientesFicticios().some((cliente) => cliente.isNegativo)).toBe(true);
  });

  it("não abre o catálogo: a montagem do pedido recebe o aviso", async () => {
    const negativo = clientesFicticios().find((cliente) => cliente.isNegativo);
    await expect(fonteFicticia.carregarCatalogo(negativo?.codigo ?? "")).rejects.toThrow(AVISO_DE_CLIENTE_NEGATIVO);
  });
});

describe("pessoa física na carteira", () => {
  const pessoasFisicas = clientesFicticios().filter((cliente) => cliente.codigoErp === null);

  it("existe, como no ERP, e é sempre do mercado praça", () => {
    expect(pessoasFisicas.length).toBeGreaterThan(0);
    for (const cliente of pessoasFisicas) expect(cliente.mercado).toBe("PRACA");
  });

  it("não leva o código do ERP para a ficha, porque nele está o CPF", () => {
    for (const cliente of pessoasFisicas) expect(fichaFicticia(cliente.codigo)?.codigoErp).toBeNull();
  });
});

function somarValores(itens: readonly { valor: number }[]): number {
  return itens.reduce((soma, item) => soma + item.valor, 0);
}
