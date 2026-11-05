import { describe, expect, it } from "vitest";
import { corteDoMesmoDiaUtil, diaUtilDoMes, diasUteisDoMes, isDiaUtil, isFeriadoNacional, somarDiasUteis } from "./calendario.ts";

describe("calendário padrão", () => {
  it("não conta fim de semana nem feriado nacional", () => {
    expect(isDiaUtil("2026-10-12")).toBe(false);
    expect(isDiaUtil("2026-10-17")).toBe(false);
    expect(isDiaUtil("2026-10-13")).toBe(true);
  });

  it("conta o 7/10 como útil: o calendário do SGI, que o marcava, ficou de fora", () => {
    expect(isDiaUtil("2026-10-07")).toBe(true);
  });

  it("acha a Sexta-feira Santa pela Páscoa de cada ano", () => {
    expect(isFeriadoNacional("2025-04-18")).toBe(true);
    expect(isFeriadoNacional("2026-04-03")).toBe(true);
    expect(isFeriadoNacional("2027-03-26")).toBe(true);
  });

  it("só tem a Consciência Negra como feriado nacional desde 2024", () => {
    expect(isFeriadoNacional("2023-11-20")).toBe(false);
    expect(isFeriadoNacional("2026-11-20")).toBe(true);
  });

  it("conta Carnaval e Corpus Christi como úteis: são ponto facultativo", () => {
    expect(isDiaUtil("2026-02-17")).toBe(true);
    expect(isDiaUtil("2026-06-04")).toBe(true);
  });

  it("conta os dias úteis do mês e até a data", () => {
    expect(diasUteisDoMes("2026-10")).toBe(21);
    expect(diaUtilDoMes("2026-10-13")).toBe(8);
    expect(diaUtilDoMes("2026-10-07")).toBe(5);
  });
});

describe("corteDoMesmoDiaUtil", () => {
  it("corta no dia útil seguinte ao Nº, para entrar o sábado depois dele", () => {
    // Outubro de 2025: o 8º dia útil é a sexta 10; o 9º, a segunda 13.
    expect(corteDoMesmoDiaUtil("2025-10", 8)).toBe("2025-10-13");
  });

  it("é nulo quando o mês não tem mais que N dias úteis: entra o mês inteiro", () => {
    expect(corteDoMesmoDiaUtil("2025-10", 23)).toBeNull();
  });
});

describe("somarDiasUteis", () => {
  it("começa a contar no dia seguinte: de quinta, 5 dias úteis dão a quinta seguinte", () => {
    expect(somarDiasUteis("2026-11-05", 5)).toBe("2026-11-12");
  });

  it("pula o fim de semana e o feriado no caminho", () => {
    // Da sexta 13/11/2026: segunda 16 a quinta 19 e, depois da Consciência Negra (sexta 20), a segunda 23.
    expect(somarDiasUteis("2026-11-13", 5)).toBe("2026-11-23");
  });

  it("conta do sábado como da sexta", () => {
    expect(somarDiasUteis("2026-11-07", 5)).toBe("2026-11-13");
  });
});
