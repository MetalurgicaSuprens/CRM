import { describe, expect, it } from "vitest";
import { lerMalha, lerMunicipios, normalizarNome } from "./ibge.ts";
import { montarMapaDaUf, montarMapaDoBrasil } from "./montarMapa.ts";

/** Dois municípios vizinhos na região 520001 e um terceiro sozinho na 520002, como na lista do IBGE. */
const LISTA = [
  municipio(5208707, "Goiânia", 520001, "Goiânia"),
  municipio(5201405, "Aparecida de Goiânia", 520001, "Goiânia"),
  municipio(5218805, "Rio Verde", 520002, "Rio Verde"),
];
const MALHA = {
  type: "FeatureCollection",
  features: [
    feicao("5208707", [[-49.3, -16.6], [-49.2, -16.6], [-49.2, -16.7], [-49.3, -16.7], [-49.3, -16.6]]),
    feicao("5201405", [[-49.2, -16.6], [-49.1, -16.6], [-49.1, -16.7], [-49.2, -16.7], [-49.2, -16.6]]),
    feicao("5218805", [[-51.0, -17.7], [-50.9, -17.7], [-50.9, -17.8], [-51.0, -17.8], [-51.0, -17.7]]),
  ],
};
const POPULACAO = { "go|goiania": 1_437_237, "go|aparecida de goiania": 527_550 };
/** O PIB da agropecuária e da indústria em R$, pelo código do IBGE; Aparecida de Goiânia ficou de fora. */
const MERCADO = { "5208707": 8_559_353_447, "5218805": 9_100_000_000 };

describe("montarMapaDaUf", () => {
  const { mapa, semPopulacao, semMercado } = montarMapaDaUf(lerMalha(MALHA), lerMunicipios(LISTA), { populacao: POPULACAO, mercado: MERCADO });

  it("traz o estado com o nome do IBGE e cada município com a região imediata, a população e o mercado", () => {
    expect(mapa).toMatchObject({ uf: "GO", nome: "Goiás" });
    expect(mapa.municipios.map(({ codigo, nome, regiao, populacao, mercado }) => [codigo, nome, regiao, populacao, mercado])).toEqual([
      ["5201405", "Aparecida de Goiânia", "520001", 527_550, null],
      ["5208707", "Goiânia", "520001", 1_437_237, 8_559_353_447],
      ["5218805", "Rio Verde", "520002", null, 9_100_000_000],
    ]);
  });

  it("aponta o município que ficou fora da base do PIB", () => {
    expect(semMercado).toEqual(["Aparecida de Goiânia"]);
  });

  it("junta os vizinhos da mesma região num contorno só, sem a divisa entre eles", () => {
    const goiania = mapa.regioes.find((regiao) => regiao.codigo === "520001");
    expect(goiania?.nome).toBe("Goiânia");
    expect(goiania?.contorno.match(/M/g)).toHaveLength(1);
    expect(mapa.contorno.match(/M/g)).toHaveLength(2);
  });

  it("grava as regiões vizinhas do mesmo estado; as que não encostam ficam sem vizinha", () => {
    expect(mapa.regioes.map(({ codigo, vizinhas }) => [codigo, vizinhas])).toEqual([
      ["520001", []],
      ["520002", []],
    ]);
  });

  it("aponta o município que não achou a população, para o nome ser conferido", () => {
    expect(semPopulacao).toEqual(["Rio Verde"]);
  });

  it("dá ao fundo do Brasil só o contorno e a caixa de cada estado", () => {
    expect(montarMapaDoBrasil([mapa]).ufs).toEqual([{ uf: "GO", nome: "Goiás", caixa: mapa.caixa, contorno: mapa.contorno }]);
  });
});

describe("lerMalha", () => {
  it("recusa a feição sem o código IBGE de 7 dígitos", () => {
    expect(() => lerMalha({ type: "FeatureCollection", features: [{ properties: { codarea: "52" }, geometry: { type: "Polygon", coordinates: [] } }] })).toThrow(
      /fora do formato/,
    );
  });
});

describe("normalizarNome", () => {
  it("tira acento, apóstrofo e maiúscula, como a base de população", () => {
    expect(normalizarNome("Alta Floresta D'Oeste")).toBe("alta floresta d oeste");
    expect(normalizarNome("São João d'Aliança")).toBe("sao joao d alianca");
  });
});

function municipio(id: number, nome: string, regiao: number, nomeDaRegiao: string) {
  return {
    id,
    nome,
    "regiao-imediata": { id: regiao, nome: nomeDaRegiao, "regiao-intermediaria": { UF: { sigla: "GO", nome: "Goiás" } } },
  };
}

function feicao(codarea: string, anel: number[][]) {
  return { type: "Feature", properties: { codarea }, geometry: { type: "Polygon", coordinates: [anel] } };
}
