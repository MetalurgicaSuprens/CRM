import { describe, expect, it } from "vitest";
import { caixaDosAneis, caminhoDosAneis, centroDoMaiorAnel, contornoDaUniao, limparAnel, vizinhosPorDivisa, type Anel } from "./geometria.ts";

const QUADRADO_A: Anel = [[0, 0], [10, 0], [10, 10], [0, 10]];
/** Vizinho à direita do A: a divisa de x = 10 vai no sentido contrário. */
const QUADRADO_B: Anel = [[10, 0], [20, 0], [20, 10], [10, 10]];

describe("limparAnel", () => {
  it("tira o ponto repetido em seguida e o fechamento do GeoJSON", () => {
    expect(limparAnel([[0, 0], [10, 0], [10, 0], [10, 10], [0, 0]])).toEqual([[0, 0], [10, 0], [10, 10]]);
  });

  it("descarta o anel que o arredondamento reduziu a menos de 3 pontos", () => {
    expect(limparAnel([[0, 0], [0, 0], [1, 1], [0, 0]])).toBeNull();
  });
});

describe("caminhoDosAneis", () => {
  it("escreve o primeiro ponto absoluto e os outros relativos", () => {
    expect(caminhoDosAneis([QUADRADO_A])).toBe("M0 0l10 0 0 10 -10 0z");
  });
});

describe("contornoDaUniao", () => {
  it("cancela a divisa dos vizinhos e deixa só o contorno de fora", () => {
    const [contorno, ...sobra] = contornoDaUniao([QUADRADO_A, QUADRADO_B]);
    expect(sobra).toEqual([]);
    expect(contorno).toHaveLength(6);
    expect(contorno).not.toContainEqual([10, 5]);
    expect(caixaDosAneis([contorno ?? []])).toEqual([0, 0, 20, 10]);
  });

  it("mantém separado o pedaço que não encosta nos outros", () => {
    const longe: Anel = [[50, 50], [60, 50], [60, 60]];
    expect(contornoDaUniao([QUADRADO_A, longe])).toHaveLength(2);
  });
});

describe("vizinhosPorDivisa", () => {
  it("liga os grupos que dividem uma aresta e deixa sozinho o que não encosta em ninguém", () => {
    const longe: Anel = [[50, 50], [60, 50], [60, 60]];
    const vizinhos = vizinhosPorDivisa(new Map([["A", [QUADRADO_A]], ["B", [QUADRADO_B]], ["C", [longe]]]));
    expect(Object.fromEntries(vizinhos)).toEqual({ A: ["B"], B: ["A"], C: [] });
  });
});

describe("centroDoMaiorAnel", () => {
  it("põe o círculo no centro do maior pedaço, sem puxar para a ilha pequena", () => {
    const ilha: Anel = [[100, 100], [101, 100], [101, 101]];
    expect(centroDoMaiorAnel([ilha, QUADRADO_A])).toEqual([5, 5]);
  });
});
