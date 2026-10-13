import { describe, expect, it } from "vitest";
import { corteDoMesmoDiaUtil, diaUtilDoMes, diasUteisDoMes, isDiaUtil } from "./calendario.ts";

/** Outubro de 2026: dia 12 (segunda) é feriado no calendário do SGI. */
const CALENDARIO = new Map([["2026-10-12", false]]);

describe("dias úteis", () => {
  it("segue o calendário do SGI e, sem linha, segunda a sexta", () => {
    expect(isDiaUtil("2026-10-12", CALENDARIO)).toBe(false);
    expect(isDiaUtil("2026-10-13", CALENDARIO)).toBe(true);
    expect(isDiaUtil("2026-10-17", CALENDARIO)).toBe(false);
  });

  it("conta os dias úteis do mês e até a data", () => {
    expect(diasUteisDoMes("2026-10", CALENDARIO)).toBe(21);
    expect(diaUtilDoMes("2026-10-13", CALENDARIO)).toBe(8);
  });
});

describe("corteDoMesmoDiaUtil", () => {
  it("corta no dia útil seguinte ao Nº, para entrar o sábado depois dele", () => {
    // Outubro de 2025: o 8º dia útil é a sexta 10; o 9º, a segunda 13.
    expect(corteDoMesmoDiaUtil("2025-10", 8, new Map())).toBe("2025-10-13");
  });

  it("é nulo quando o mês não tem mais que N dias úteis: entra o mês inteiro", () => {
    expect(corteDoMesmoDiaUtil("2025-10", 23, new Map())).toBeNull();
  });
});
