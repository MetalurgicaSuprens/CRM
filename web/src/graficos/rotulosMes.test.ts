import { describe, expect, it } from "vitest";
import { somarMeses } from "dominio/datas";
import { rotularMeses } from "./rotulosMes";

describe("rotularMeses", () => {
  it("num ano, rotula um mês a cada intervalo, só com o nome do mês", () => {
    expect(rotularMeses(["2026-01", "2026-02", "2026-03"], 1)).toEqual(["jan", "fev", "mar"]);
    expect(rotularMeses(["2026-01", "2026-02", "2026-03"], 2)).toEqual(["jan", null, "mar"]);
  });

  it("em vários anos, rotula só cada janeiro, com o ano", () => {
    const vinteECincoMeses = Array.from({ length: 25 }, (_, i) => somarMeses("2024-10", i));
    expect(rotularMeses(vinteECincoMeses, 1).filter((rotulo) => rotulo !== null)).toEqual(["2025", "2026"]);
  });
});
