import { describe, expect, it } from "vitest";
import { somarMeses } from "dominio/datas";
import {
  aFaturarNoMes,
  compararNoMesmoMes,
  montarAcumulados,
  montarBlocosDe12Meses,
  montarMapaDeCalor,
  montarMesAMes,
  montarTendencia,
  resumirATendencia,
  resumirOAno,
} from "./faturamentoDoCliente";
import type { FaturamentoMensal, PedidoDaFicha } from "./tipos";

/** Os 60 meses fechados antes de `mesAtual` e ele, com o valor de cada um dado por `valorDe`. */
function historia(mesAtual: string, valorDe: (mes: string) => number = () => 100): FaturamentoMensal[] {
  return Array.from({ length: 61 }, (_, i) => somarMeses(mesAtual, i - 60)).map((mes) => ({ mes, valor: valorDe(mes), pecas: valorDe(mes) / 10 }));
}

function pedido(status: PedidoDaFicha["status"], itens: { valor: number; entrega: string | null }[]): PedidoDaFicha {
  return {
    id: `${status}-${itens.length}`,
    cnpj: null,
    numero: "1",
    status,
    emissao: "2026-09-01",
    entrega: itens[0]?.entrega ?? null,
    itens: itens.map((item, i) => ({ ordem: i + 1, codigo: "F-100", familia: "FLEXIL", pecas: 10, ...item })),
    valor: itens.reduce((soma, { valor }) => soma + valor, 0),
  };
}

describe("montarTendencia", () => {
  it("soma os 12 meses até cada mês fechado, nos últimos 4 anos, com o mesmo número 1 ano antes", () => {
    const valorDe = (mes: string) => (mes >= "2025-10" ? 200 : 100);
    const pontos = montarTendencia(historia("2026-10", valorDe), "2026-10");
    expect(pontos).toHaveLength(48);
    expect(pontos[0]).toEqual({ mes: "2022-10", valor: 1_200, anoAntes: null });
    // De out/25 a set/26, tudo a 200; 1 ano antes, tudo a 100: é o "Faturado em 12 meses" e a variação do alto da ficha.
    expect(pontos.at(-1)).toEqual({ mes: "2026-09", valor: 2_400, anoAntes: 1_200 });
  });

  it("deixa de fora o ponto sem 12 meses de história, como na carteira fictícia, de 36 meses", () => {
    const pontos = montarTendencia(historia("2026-10").slice(-37), "2026-10");
    expect(pontos).toHaveLength(25);
    expect(pontos[0]).toEqual({ mes: "2024-09", valor: 1_200, anoAntes: null });
  });
});

describe("resumirATendencia", () => {
  it("diz de quando a tendência parte e quanto ela andou até o último ponto", () => {
    const pontos = [
      { mes: "2022-10", valor: 1_000, anoAntes: null },
      { mes: "2026-09", valor: 1_500, anoAntes: 1_200 },
    ];
    expect(resumirATendencia(pontos)).toEqual({ desde: "2022-10", variacao: 0.5 });
  });

  it("não calcula a variação de quem partiu do zero, nem resume um ponto só", () => {
    expect(resumirATendencia([{ mes: "2022-10", valor: 0, anoAntes: null }, { mes: "2026-09", valor: 900, anoAntes: null }])).toEqual({ desde: "2022-10", variacao: null });
    expect(resumirATendencia([{ mes: "2026-09", valor: 900, anoAntes: null }])).toBeNull();
  });
});

describe("montarBlocosDe12Meses", () => {
  it("soma o faturado e as peças em 4 blocos de 12 meses fechados, o último até o mês passado", () => {
    const valorDe = (mes: string) => (mes >= "2025-10" ? 200 : 100);
    const blocos = montarBlocosDe12Meses(historia("2026-10", valorDe), "2026-10");
    expect(blocos.map(({ inicio, fim }) => `${inicio} a ${fim}`)).toEqual([
      "2022-10 a 2023-09",
      "2023-10 a 2024-09",
      "2024-10 a 2025-09",
      "2025-10 a 2026-09",
    ]);
    expect(blocos[0]).toEqual({ inicio: "2022-10", fim: "2023-09", valor: 1_200, pecas: 120 });
    expect(blocos.at(-1)).toEqual({ inicio: "2025-10", fim: "2026-09", valor: 2_400, pecas: 240 });
  });

  it("deixa de fora o bloco que a história não cobre inteiro, como na carteira fictícia, de 36 meses", () => {
    expect(montarBlocosDe12Meses(historia("2026-10").slice(-37), "2026-10")).toHaveLength(3);
  });
});

describe("montarAcumulados", () => {
  it("soma cada um dos 4 anos de janeiro em diante, e o ano corrente só até o mês passado", () => {
    const anos = montarAcumulados(historia("2026-10"), "2026-10");
    expect(anos.map(({ ano, acumulado }) => [ano, acumulado.length])).toEqual([
      [2023, 12],
      [2024, 12],
      [2025, 12],
      [2026, 9],
    ]);
    expect(anos[0]?.acumulado.slice(0, 3)).toEqual([100, 200, 300]);
    expect(anos.at(-1)?.acumulado.at(-1)).toBe(900);
  });

  it("em janeiro, sem mês fechado no ano, mostra os 4 anos inteiros até o que acabou", () => {
    expect(montarAcumulados(historia("2027-01"), "2027-01").map(({ ano, acumulado }) => [ano, acumulado.length])).toEqual([
      [2023, 12],
      [2024, 12],
      [2025, 12],
      [2026, 12],
    ]);
  });

  it("deixa de fora o ano que a história não cobre inteiro", () => {
    expect(montarAcumulados(historia("2026-10").slice(-37), "2026-10").map(({ ano }) => ano)).toEqual([2024, 2025, 2026]);
  });
});

describe("compararNoMesmoMes", () => {
  it("compara o ano mais recente com cada anterior, somados até o mesmo mês", () => {
    const anos = [
      { ano: 2024, acumulado: [100, 200, 300] },
      { ano: 2025, acumulado: [50, 100, 150] },
      { ano: 2026, acumulado: [100, 300] },
    ];
    expect(compararNoMesmoMes(anos)).toEqual({
      ano: 2026,
      mes: 2,
      comparacoes: [
        { ano: 2025, razao: 2 },
        { ano: 2024, razao: 0.5 },
      ],
    });
  });

  it("não calcula a variação contra o ano que não faturou até o mesmo mês", () => {
    expect(compararNoMesmoMes([{ ano: 2025, acumulado: [0, 0] }, { ano: 2026, acumulado: [100, 300] }])?.comparacoes).toEqual([{ ano: 2025, razao: null }]);
  });
});

describe("montarMapaDeCalor", () => {
  const sem = (mes: string) => (mes === "2024-03" || mes === "2026-02" ? 0 : 100);

  it("põe o faturado de cada mês dos 4 anos no lugar, e null nos meses que ainda não fecharam", () => {
    const mapa = montarMapaDeCalor(historia("2026-10", sem), "2026-10");
    expect(mapa.map(({ ano }) => ano)).toEqual([2023, 2024, 2025, 2026]);
    expect(mapa[1]?.meses[2]).toBe(0);
    expect(mapa[3]?.meses.slice(8)).toEqual([100, null, null, null]);
  });

  it("conta os meses com compra entre os que fecharam", () => {
    const mapa = montarMapaDeCalor(historia("2026-10", sem), "2026-10");
    expect(mapa.map(({ mesesComCompra, mesesFechados }) => `${mesesComCompra} de ${mesesFechados}`)).toEqual(["12 de 12", "11 de 12", "12 de 12", "8 de 9"]);
  });
});

describe("montarMesAMes", () => {
  it("dá os 12 meses do ano corrente contra o anterior, e o a faturar só no mês corrente", () => {
    const valorDe = (mes: string) => (mes.startsWith("2026") ? 300 : 100);
    const barras = montarMesAMes(historia("2026-10", valorDe), "2026-10", 500);
    expect(barras).toHaveLength(12);
    expect(barras[0]).toEqual({ mes: "2026-01", valor: 300, comparacao: 100, aFaturar: null });
    expect(barras[9]).toEqual({ mes: "2026-10", valor: 300, comparacao: 100, aFaturar: 500 });
    // Os meses que ainda não chegaram mostram só o ano anterior.
    expect(barras[11]).toEqual({ mes: "2026-12", valor: null, comparacao: 100, aFaturar: null });
  });
});

describe("aFaturarNoMes", () => {
  it("soma o saldo em aberto com entrega até o fim do mês, os atrasados também, e só dos pedidos em aberto", () => {
    const pedidos = [
      pedido("em_aberto", [
        { valor: 1_000, entrega: "2026-10-28" },
        { valor: 400, entrega: "2026-09-15" },
        { valor: 9_000, entrega: "2026-11-05" },
      ]),
      pedido("faturado", [{ valor: 7_000, entrega: "2026-10-10" }]),
    ];
    expect(aFaturarNoMes(pedidos, "2026-10")).toBe(1_400);
  });
});

describe("resumirOAno", () => {
  it("compara os meses fechados do ano com os mesmos do ano anterior", () => {
    const valorDe = (mes: string) => (mes.startsWith("2026") ? 300 : 100);
    expect(resumirOAno(historia("2026-10", valorDe), "2026-10")).toEqual({ inicio: "2026-01", fim: "2026-09", valor: 2_700, anoAnterior: 900 });
  });

  it("não resume o ano em janeiro, que ainda não tem mês fechado", () => {
    expect(resumirOAno(historia("2027-01"), "2027-01")).toBeNull();
  });
});
