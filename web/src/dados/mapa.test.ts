import { describe, expect, it } from "vitest";
import type { MapaDaUf } from "dominio/mapa";
import { aRecuperarPorCliente, classeDaLacuna, montarTerritorio } from "./mapa";
import type { ClienteResumo } from "./tipos";

/**
 * Quatro regiões: Goiânia (1,4 milhão de habitantes, com a cidade vizinha) e Rio Verde (250 mil), com
 * clientes; Anápolis (400 mil), sem cliente, mas vizinha de Goiânia; e Posse (100 mil), longe de todos.
 */
const MAPA: MapaDaUf = {
  uf: "GO",
  nome: "Goiás",
  caixa: [0, 0, 100, 100],
  contorno: "",
  regioes: [
    { codigo: "520001", nome: "Goiânia", contorno: "", caixa: [0, 0, 50, 50], vizinhas: ["520003"] },
    { codigo: "520002", nome: "Rio Verde", contorno: "", caixa: [50, 50, 100, 100], vizinhas: [] },
    { codigo: "520003", nome: "Anápolis", contorno: "", caixa: [0, 50, 50, 100], vizinhas: ["520001"] },
    { codigo: "520004", nome: "Posse", contorno: "", caixa: [50, 0, 100, 50], vizinhas: [] },
  ],
  municipios: [
    { codigo: "5208707", nome: "Goiânia", regiao: "520001", populacao: 1_200_000, d: "", centro: [10, 10] },
    { codigo: "5201405", nome: "Aparecida de Goiânia", regiao: "520001", populacao: 200_000, d: "", centro: [20, 20] },
    { codigo: "5218805", nome: "Rio Verde", regiao: "520002", populacao: 250_000, d: "", centro: [70, 70] },
    { codigo: "5201108", nome: "Anápolis", regiao: "520003", populacao: 400_000, d: "", centro: [20, 70] },
    { codigo: "5218300", nome: "Posse", regiao: "520004", populacao: 100_000, d: "", centro: [70, 20] },
  ],
};
/** 1,05 milhão de receita para os 2,05 milhões de habitantes da área: Goiânia, Rio Verde e Anápolis. */
const RECEITA_POR_HABITANTE = 1_050_000 / 2_050_000;

function cliente(codigo: string, municipio: string | null, faturamento12m: number): ClienteResumo {
  return {
    codigo,
    codigoErp: null,
    nome: `Cliente ${codigo}`,
    cidade: "",
    uf: "GO",
    municipio,
    mercado: "PRACA",
    situacao: "ativo",
    status: "ativo",
    ultimaCompra: null,
    faturamento12m,
    variacao12m: null,
    quedaNoSemestre: null,
    evolucao12m: [],
    cnpjs: null,
  };
}

const CLIENTES = [
  cliente("a", "5208707", 600_000),
  cliente("b", "5208707", 300_000),
  cliente("c", "5201405", 100_000),
  cliente("d", "5218805", 50_000),
  // Sem o código no cadastro: fica fora do mapa.
  cliente("e", null, 999_000),
];

describe("montarTerritorio", () => {
  const territorio = montarTerritorio(MAPA, CLIENTES, new Map([["b", 2_000], ["d", 500]]));
  const regiao = (codigo: string) => territorio.regioes.find((r) => r.regiao.codigo === codigo);

  it("soma a receita e os clientes de cada município, sem o cliente sem município", () => {
    expect(territorio.receita).toBe(1_050_000);
    expect(territorio.clientes).toBe(4);
    expect(territorio.municipios.get("5208707")).toMatchObject({ receita: 900_000, aRecuperarPorMes: 2_000 });
  });

  it("dá a cada região a parte da receita do estado, com os municípios do que mais fatura ao que menos", () => {
    expect(regiao("520001")).toMatchObject({ populacao: 1_400_000, receita: 1_000_000, clientes: 3 });
    expect(regiao("520001")?.participacao).toBeCloseTo(1_000_000 / 1_050_000);
    expect(regiao("520001")?.municipios.map((presenca) => presenca.municipio.nome)).toEqual(["Goiânia", "Aparecida de Goiânia"]);
  });

  it("mede o potencial pela receita por habitante da área: a região fraca fica com a lacuna", () => {
    expect(territorio.receitaPorHabitante).toBeCloseTo(RECEITA_POR_HABITANTE);
    expect(regiao("520002")?.potencial).toBeCloseTo(250_000 * RECEITA_POR_HABITANTE);
    expect(regiao("520002")?.lacuna).toBeCloseTo(250_000 * RECEITA_POR_HABITANTE - 50_000);
    expect(regiao("520001")?.lacuna).toBe(0);
  });

  it("põe na área a vizinha sem cliente, com todo o potencial a conquistar", () => {
    expect(regiao("520003")).toMatchObject({ isDaArea: true, receita: 0, clientes: 0 });
    expect(regiao("520003")?.lacuna).toBeCloseTo(400_000 * RECEITA_POR_HABITANTE);
  });

  it("deixa fora da área, sem potencial, a região sem cliente nem vizinha com cliente", () => {
    expect(regiao("520004")).toMatchObject({ isDaArea: false, potencial: 0, lacuna: 0 });
  });

  it("conta quantos municípios fazem 80% da receita e o que há para recuperar", () => {
    expect(territorio.municipiosPara80).toBe(1);
    expect(territorio).toMatchObject({ aRecuperarPorMes: 2_500, clientesARecuperar: 2 });
  });
});

describe("aRecuperarPorCliente", () => {
  it("usa a perda mensal de quem parou e a queda por mês de quem está comprando menos", () => {
    const porCliente = aRecuperarPorCliente({
      pararam: [{ cliente: cliente("p", null, 0), diasSemComprar: 200, cicloDias: 30, perdaMensal: 3_000 }],
      menos: [{ cliente: cliente("m", null, 0), semestre: 4_000, semestreAnoAnterior: 10_000, variacao: -0.6, variacaoPecas: null }],
    });
    expect(porCliente.get("p")).toBe(3_000);
    expect(porCliente.get("m")).toBe(1_000);
  });

  it("divide o valor do grupo entre os CNPJs pela parte de cada um no faturado, ou igual se ele não faturou", () => {
    const grupo = { ...cliente("g", null, 40_000), cnpjs: [cliente("g1", "5208707", 30_000), cliente("g2", "5211909", 10_000)] };
    const parado = { ...cliente("h", null, 0), cnpjs: [cliente("h1", "5208707", 0), cliente("h2", "5211909", 0)] };
    const porCliente = aRecuperarPorCliente({
      pararam: [{ cliente: parado, diasSemComprar: 200, cicloDias: 30, perdaMensal: 2_000 }],
      menos: [{ cliente: grupo, semestre: 4_000, semestreAnoAnterior: 10_000, variacao: -0.6, variacaoPecas: null }],
    });
    expect([...porCliente.entries()].sort()).toEqual([
      ["g1", 750],
      ["g2", 250],
      ["h1", 1_000],
      ["h2", 1_000],
    ]);
  });
});

describe("classeDaLacuna", () => {
  const lacunas = [0, 100, 200, 300, 400, 0];

  it("põe a região sem lacuna na classe 0, a do fundo do mapa", () => {
    expect(classeDaLacuna(0, lacunas)).toBe(0);
  });

  it("reparte as regiões com lacuna pelos quartis, da menor à maior", () => {
    expect(lacunas.filter((lacuna) => lacuna > 0).map((lacuna) => classeDaLacuna(lacuna, lacunas))).toEqual([1, 2, 3, 4]);
  });
});
