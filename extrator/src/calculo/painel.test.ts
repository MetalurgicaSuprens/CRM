import { describe, expect, it } from "vitest";
import { montarPainel } from "./painel.ts";
import { montarReferencia } from "./referencia.ts";

const REFERENCIA = montarReferencia("2026-10-13T09:50");

describe("montarPainel", () => {
  const vendas = [
    { representante: "1401", dia: "2026-10-05", valor: 1_000 },
    { representante: "1401", dia: "2026-09-10", valor: 500 },
    { representante: "1401", dia: "2025-10-10", valor: 300 },
    // Sábado depois do 8º dia útil de outubro de 2025: entra no "mesmo dia útil".
    { representante: "1401", dia: "2025-10-11", valor: 200 },
    { representante: "1401", dia: "2025-10-20", valor: 4_000 },
    { representante: "1402", dia: "2026-10-06", valor: 9_999 },
  ];
  const painel = montarPainel(vendas, ["1401"], REFERENCIA, new Map([["2026-10-12", false]]));
  const mes = (numero: string) => painel.find((linha) => linha.mes === `2026-${numero}`);

  it("tem os 12 meses do ano de cada representante, só com as vendas dele", () => {
    expect(painel).toHaveLength(12);
    expect(mes("10")?.faturado).toBe(1_000);
    expect(mes("09")?.faturado).toBe(500);
  });

  it("deixa nulo o faturado dos meses que ainda não chegaram", () => {
    expect(mes("11")?.faturado).toBeNull();
    expect(mes("11")?.anoAnterior).toBe(0);
  });

  it("compara o mês corrente com o ano anterior até o mesmo dia útil", () => {
    expect(mes("10")?.anoAnterior).toBe(4_500);
    expect(mes("10")?.anoAnteriorAteDiaUtil).toBe(500);
    expect(mes("09")?.anoAnteriorAteDiaUtil).toBeNull();
  });
});
