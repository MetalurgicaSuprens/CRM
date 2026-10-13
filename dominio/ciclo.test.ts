import { describe, expect, it } from "vitest";
import { cicloTipico, comprasDasNotas } from "./ciclo.ts";

const HOJE = "2026-10-13";

describe("comprasDasNotas", () => {
  it("junta numa compra as notas até 7 dias depois da primeira", () => {
    expect(comprasDasNotas(["2026-09-01", "2026-09-03", "2026-09-08", "2026-09-09"])).toEqual(["2026-09-01", "2026-09-09"]);
  });

  it("não encadeia: a nota a 7 dias da segunda, mas a 8 da primeira, abre outra compra", () => {
    expect(comprasDasNotas(["2026-09-01", "2026-09-06", "2026-09-09"])).toEqual(["2026-09-01", "2026-09-09"]);
  });
});

describe("cicloTipico", () => {
  it("é a mediana dos intervalos entre as compras", () => {
    expect(cicloTipico(["2026-06-01", "2026-07-02", "2026-08-16", "2026-09-15"], HOJE)).toBe(31);
  });

  it("é nulo com menos de 4 compras nos 24 meses", () => {
    expect(cicloTipico(["2023-01-10", "2026-07-01", "2026-08-01", "2026-09-01"], HOJE)).toBeNull();
  });

  it("fica em 30 dias para quem compra mais de uma vez por mês", () => {
    expect(cicloTipico(["2026-08-01", "2026-08-12", "2026-08-23", "2026-09-03"], HOJE)).toBe(30);
  });

  it("é nulo acima de 180 dias: o cliente é irregular", () => {
    expect(cicloTipico(["2024-11-01", "2025-06-01", "2026-01-01", "2026-08-01"], HOJE)).toBeNull();
  });
});
