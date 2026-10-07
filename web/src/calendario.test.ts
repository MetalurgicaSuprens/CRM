import { describe, expect, it } from "vitest";
import { diasUteisAte, diasUteisDoMes, somarDias, somarMeses, ultimoDiaDoMes } from "./calendario";

describe("calendário", () => {
  it("soma dias atravessando mês e ano", () => {
    expect(somarDias("2026-10-07", 30)).toBe("2026-11-06");
    expect(somarDias("2026-01-05", -10)).toBe("2025-12-26");
  });

  it("soma e subtrai meses atravessando o ano", () => {
    expect(somarMeses("2026-10", 3)).toBe("2027-01");
    expect(somarMeses("2026-01", -1)).toBe("2025-12");
    expect(somarMeses("2026-10", -24)).toBe("2024-10");
  });

  it("conta dias úteis de segunda a sexta", () => {
    expect(diasUteisDoMes("2026-10")).toBe(22);
    expect(diasUteisAte("2026-10-07")).toBe(5);
  });

  it("sabe o último dia de fevereiro", () => {
    expect(ultimoDiaDoMes("2028-02")).toBe(29);
    expect(ultimoDiaDoMes("2026-02")).toBe(28);
  });
});
