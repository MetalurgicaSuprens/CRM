import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  dataDoMomento,
  diasUteisAte,
  diasUteisDoMes,
  horaDoMomento,
  momentoEmBrasilia,
  somarDias,
  somarMeses,
  ultimoDiaDoMes,
} from "./calendario";

describe("relógio de Brasília", () => {
  // Um aparelho em outro fuso: esta máquina já está em Brasília e não pegaria o erro.
  beforeAll(() => vi.stubEnv("TZ", "Asia/Tokyo"));
  afterAll(() => vi.unstubAllEnvs());

  it("converte o instante para a hora de Brasília", () => {
    expect(momentoEmBrasilia(new Date("2026-10-09T12:15:00Z"))).toBe("2026-10-09T09:15");
  });

  it("ainda é o dia anterior em Brasília depois da meia-noite em UTC", () => {
    expect(momentoEmBrasilia(new Date("2026-10-09T02:30:00Z"))).toBe("2026-10-08T23:30");
  });

  it("escreve a meia-noite como 00, não 24", () => {
    expect(momentoEmBrasilia(new Date("2026-10-09T03:05:00Z"))).toBe("2026-10-09T00:05");
  });

  it("separa a data e a hora do momento", () => {
    expect(dataDoMomento("2026-10-09T09:15")).toBe("2026-10-09");
    expect(horaDoMomento("2026-10-09T09:15")).toBe("09:15");
  });
});

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
