import { describe, expect, it } from "vitest";
import { projetarMes } from "./projecao.ts";

describe("projetarMes", () => {
  it("soma ao faturado o ritmo dos últimos 6 meses nos dias úteis que faltam", () => {
    const projecao = projetarMes({ faturado: 313_929, ritmoPorDiaUtil: 23_702, diasUteisRestantes: 13, aFaturarNoMes: 52_629 });
    expect(projecao).toEqual({ valor: 313_929 + 23_702 * 13, base: "ritmo" });
  });

  it("usa a carteira do mês quando ela passa do que o ritmo prevê", () => {
    const projecao = projetarMes({ faturado: 500_000, ritmoPorDiaUtil: 20_000, diasUteisRestantes: 2, aFaturarNoMes: 90_000 });
    expect(projecao).toEqual({ valor: 590_000, base: "carteira" });
  });

  it("no último dia útil fica no faturado mais a carteira", () => {
    const projecao = projetarMes({ faturado: 480_000, ritmoPorDiaUtil: 20_000, diasUteisRestantes: 0, aFaturarNoMes: 5_000 });
    expect(projecao).toEqual({ valor: 485_000, base: "carteira" });
  });
});
