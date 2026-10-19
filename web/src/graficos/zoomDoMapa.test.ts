import { describe, expect, it } from "vitest";
import { aproximar, arrastar, vistaDaCaixa } from "./zoomDoMapa";

const QUADRO = { largura: 400, altura: 200 };
const VISTA = { x: 0, y: 0, largura: 100, altura: 50 };
const LIMITES = { larguraMinima: 10, larguraMaxima: 400 };

describe("aproximar", () => {
  it("aproxima em volta do ponto: o que está sob o ponteiro continua sob ele", () => {
    const caixa = aproximar(VISTA, 0.5, [100, 50], QUADRO, LIMITES);
    // O ponteiro está em 1/4 da largura e 1/4 da altura: no ponto (25, 12,5) do mapa.
    expect(caixa).toEqual([12.5, 6.25, 62.5, 31.25]);
  });

  it("afasta com o fator acima de 1, e no meio do quadro o centro fica parado", () => {
    expect(aproximar(VISTA, 2, [200, 100], QUADRO, LIMITES)).toEqual([-50, -25, 150, 75]);
  });

  it("para nos limites do zoom", () => {
    const [x0, , x1] = aproximar(VISTA, 0.01, [200, 100], QUADRO, LIMITES);
    expect(x1 - x0).toBe(10);
    const [y0, , y1] = aproximar(VISTA, 100, [200, 100], QUADRO, LIMITES);
    expect(y1 - y0).toBe(400);
  });
});

describe("arrastar", () => {
  it("leva o mapa junto com o dedo: arrastar para a direita mostra o que estava à esquerda", () => {
    expect(arrastar(VISTA, [40, -20], QUADRO)).toEqual([-10, 5, 90, 55]);
  });
});

describe("vistaDaCaixa", () => {
  it("dá a origem e o tamanho", () => {
    expect(vistaDaCaixa([10, 20, 110, 70])).toEqual({ x: 10, y: 20, largura: 100, altura: 50 });
  });
});
