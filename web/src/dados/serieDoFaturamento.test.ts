import { describe, expect, it } from "vitest";
import { somarMeses } from "dominio/datas";
import { montarSerieDoFaturamento } from "./serieDoFaturamento";
import type { FaturamentoMensal } from "./tipos";

/** Os 60 meses fechados antes de `mesAtual` e ele, com o valor de cada um dado por `valorDe`. */
function historia(mesAtual: string, valorDe: (mes: string) => number = () => 100): FaturamentoMensal[] {
  return Array.from({ length: 61 }, (_, i) => somarMeses(mesAtual, i - 60)).map((mes) => ({ mes, valor: valorDe(mes) }));
}

describe("montarSerieDoFaturamento", () => {
  it("mostra por mês os meses fechados do período e o corrente, como o gráfico de antes", () => {
    const barras = montarSerieDoFaturamento(historia("2026-10"), "2026-10", { periodo: 24, resolucao: "mensal" });
    expect(barras).toHaveLength(25);
    expect(barras[0]?.mes).toBe("2024-10");
    expect(barras.at(-1)).toMatchObject({ mes: "2026-10", isCorrente: true, media: null });
  });

  it("dá à barra a média dos 12 meses até ela, inclusive: em jan/24, de fev/23 a jan/24", () => {
    // Fevereiro de 2023 entra na média; janeiro de 2023 já não entra.
    const valorDe = (mes: string) => (mes === "2023-02" ? 1_300 : mes === "2023-01" ? 50_000 : 100);
    const barras = montarSerieDoFaturamento(historia("2026-01", valorDe), "2026-01", { periodo: 24, resolucao: "mensal" });
    expect(barras[0]).toEqual({ mes: "2024-01", valor: 100, media: (1_300 + 11 * 100) / 12, isCorrente: false });
  });

  it("soma os trimestres do calendário, e o corrente traz só os meses que já começaram", () => {
    const barras = montarSerieDoFaturamento(historia("2026-11"), "2026-11", { periodo: 12, resolucao: "trimestral" });
    // De nov/25 a out/26 fechados: o primeiro trimestre começa em outubro de 2025.
    expect(barras.map(({ mes }) => mes)).toEqual(["2025-10", "2026-01", "2026-04", "2026-07", "2026-10"]);
    expect(barras[0]).toEqual({ mes: "2025-10", valor: 300, media: 300, isCorrente: false });
    // Outubro fechou e novembro é o corrente: a média vai até outubro.
    expect(barras.at(-1)).toEqual({ mes: "2026-10", valor: 200, media: 300, isCorrente: true });
  });

  it("soma os anos do calendário; no corrente, a média é a dos 12 meses fechados, na escala do ano", () => {
    const valorDe = (mes: string) => (mes >= "2026-01" ? 200 : 100);
    const barras = montarSerieDoFaturamento(historia("2026-10", valorDe), "2026-10", { periodo: 24, resolucao: "anual" });
    expect(barras.map(({ mes }) => mes)).toEqual(["2024-01", "2025-01", "2026-01"]);
    expect(barras[0]).toEqual({ mes: "2024-01", valor: 1_200, media: 1_200, isCorrente: false });
    // 2026 até outubro: 10 meses de 200; os 12 meses fechados, de out/25 a set/26, somam 3 × 100 + 9 × 200.
    expect(barras.at(-1)).toEqual({ mes: "2026-01", valor: 2_000, media: 2_100, isCorrente: true });
  });

  it("deixa de fora a barra sem história e sem média onde faltam meses, como na carteira fictícia", () => {
    const ficticia = historia("2026-10").slice(-37);
    const barras = montarSerieDoFaturamento(ficticia, "2026-10", { periodo: 48, resolucao: "mensal" });
    expect(barras).toHaveLength(37);
    expect(barras[0]).toMatchObject({ mes: "2023-10", media: null });
    expect(barras[11]).toMatchObject({ mes: "2024-09", media: 100 });
  });
});
