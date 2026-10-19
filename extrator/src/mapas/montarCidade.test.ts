import { describe, expect, it } from "vitest";
import type { Anel } from "./geometria.ts";
import { montarMapaDaCidade } from "./montarCidade.ts";

const QUADRADO: Anel = [[0, 0], [0, 100], [100, 100], [100, 0]];
const OESTE: Anel = [[0, 0], [0, 100], [50, 100], [50, 0]];
const LESTE: Anel = [[50, 0], [50, 100], [100, 100], [100, 0]];

describe("montarMapaDaCidade", () => {
  it("usa os bairros quando a cidade tem dois ou mais, em ordem de nome, com o centro de cada um", () => {
    const cidade = montarMapaDaCidade("4106902", [QUADRADO], {
      bairros: [{ nome: "Xaxim", aneis: [LESTE] }, { nome: "Água Verde", aneis: [OESTE] }],
      distritos: [],
    });
    expect(cidade.caixa).toEqual([0, 0, 100, 100]);
    expect(cidade.divisoes?.tipo).toBe("bairro");
    expect(cidade.divisoes?.areas.map(({ nome, centro }) => [nome, centro])).toEqual([
      ["Água Verde", [25, 50]],
      ["Xaxim", [75, 50]],
    ]);
  });

  it("sem bairros, usa os distritos; com um distrito só, fica sem divisões", () => {
    const distritos = [{ nome: "Sede", aneis: [OESTE] }, { nome: "Distrito Norte", aneis: [LESTE] }];
    expect(montarMapaDaCidade("3550308", [QUADRADO], { bairros: [], distritos }).divisoes?.tipo).toBe("distrito");
    expect(montarMapaDaCidade("5208707", [QUADRADO], { bairros: [], distritos: [{ nome: "Goiânia", aneis: [QUADRADO] }] }).divisoes).toBeNull();
  });
});
