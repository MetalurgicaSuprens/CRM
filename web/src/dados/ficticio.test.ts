import { describe, expect, it } from "vitest";
import { clientesFicticios } from "./ficticio";

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
