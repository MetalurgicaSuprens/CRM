import { describe, expect, it } from "vitest";
import { somarMeses } from "dominio/datas";
import { rotularMeses } from "./rotulosMes";

const vinteECincoMeses = Array.from({ length: 25 }, (_, i) => somarMeses("2024-10", i));

describe("rotularMeses", () => {
  it("mostra o ano quando ele muda entre rótulos espaçados", () => {
    const rotulos = rotularMeses(vinteECincoMeses, 4, true).filter((rotulo) => rotulo !== null);
    expect(rotulos).toEqual(["out/24", "fev/25", "jun", "out", "fev/26", "jun", "out"]);
  });

  it("marca a virada do ano em janeiro quando todos os meses têm rótulo", () => {
    const rotulos = rotularMeses(vinteECincoMeses.slice(0, 5), 1, true);
    expect(rotulos).toEqual(["out/24", "nov", "dez", "jan/25", "fev"]);
  });

  it("usa só o mês dentro de um único ano", () => {
    expect(rotularMeses(["2026-01", "2026-02", "2026-03"], 1, false)).toEqual(["jan", "fev", "mar"]);
  });
});
