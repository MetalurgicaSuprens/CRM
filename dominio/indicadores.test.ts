import { describe, expect, it } from "vitest";
import { evolucao12m, variacao12m } from "./indicadores.ts";

/** 24 meses fechados: 1.000 por mês no primeiro ano e 1.500 no segundo. */
const MESES = [...Array.from({ length: 12 }, () => 1_000), ...Array.from({ length: 12 }, () => 1_500)];

describe("evolucao12m", () => {
  it("tem 13 pontos, do ano anterior fechado até o último mês", () => {
    const evolucao = evolucao12m(MESES);
    expect(evolucao).toHaveLength(13);
    expect(evolucao[0]).toBe(12_000);
    expect(evolucao[6]).toBe(15_000);
    expect(evolucao[12]).toBe(18_000);
  });
});

describe("variacao12m", () => {
  it("divide o último ponto pelo primeiro", () => {
    expect(variacao12m(evolucao12m(MESES))).toBeCloseTo(0.5);
  });

  it("é nula com menos de R$ 2 mil nos 12 meses anteriores", () => {
    expect(variacao12m([1_999, ...Array.from({ length: 12 }, () => 50_000)])).toBeNull();
  });
});
