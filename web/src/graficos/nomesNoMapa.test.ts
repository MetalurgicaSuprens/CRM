import { describe, expect, it } from "vitest";
import type { MunicipioDoMapa } from "dominio/mapa";
import { posicionarNomes } from "./nomesNoMapa";

/** Um quadro de 400 por 200, com 1 unidade do mapa por px e círculos de 10 px de raio. */
const CONTEXTO = { vista: { x: 0, y: 0, largura: 400, altura: 200 }, escala: 1, raioDe: () => 10 };

function municipio(nome: string, centro: [number, number]): MunicipioDoMapa {
  return { codigo: nome, nome, regiao: "", populacao: null, d: "", centro };
}

describe("posicionarNomes", () => {
  it("põe o nome à direita do círculo, com a linha de base um pouco abaixo do centro", () => {
    const [nome] = posicionarNomes([municipio("Franca", [100, 100])], CONTEXTO);
    expect(nome).toMatchObject({ x: 115, y: 104, isAEsquerda: false });
  });

  it("passa o nome para a esquerda quando à direita ele sairia do quadro", () => {
    const [nome] = posicionarNomes([municipio("Franca", [380, 100])], CONTEXTO);
    expect(nome).toMatchObject({ x: 365, isAEsquerda: true });
  });

  it("passa para a esquerda o nome que encostaria no de um município que pesa mais", () => {
    const nomes = posicionarNomes([municipio("Campinas", [100, 100]), municipio("Piracicaba", [90, 106])], CONTEXTO);
    expect(nomes.map(({ municipio: { nome }, isAEsquerda }) => [nome, isAEsquerda])).toEqual([
      ["Campinas", false],
      ["Piracicaba", true],
    ]);
  });

  it("deixa sem nome o município sem lugar dos dois lados e o que ficou fora do quadro", () => {
    const nomes = posicionarNomes(
      [municipio("Campinas", [100, 100]), municipio("Americana", [100, 100]), municipio("Sumaré", [100, 100]), municipio("Santos", [500, 100])],
      CONTEXTO,
    );
    expect(nomes.map(({ municipio: { nome } }) => nome)).toEqual(["Campinas", "Americana"]);
  });
});
