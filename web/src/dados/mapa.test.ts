import { describe, expect, it } from "vitest";
import type { MapaDaUf } from "dominio/mapa";
import { acoesDaCarteira, classeDaLacuna, direcaoDaReceita, emJogoPorMes, faixaDeRecencia, gravidadeDoCliente, montarTerritorio } from "./mapa";
import type { Analises, ClienteResumo } from "./tipos";

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
const HOJE = "2026-10-18";

function cliente(codigo: string, municipio: string | null, faturamento12m: number, outros: Partial<ClienteResumo> = {}): ClienteResumo {
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
    cicloDias: null,
    faturamento12m,
    variacao12m: null,
    quedaNoSemestre: null,
    evolucao12m: [],
    cnpjs: null,
    ...outros,
  };
}

const CLIENTES = [
  cliente("a", "5208707", 600_000, { evolucao12m: [500_000], ultimaCompra: "2026-10-01" }),
  cliente("b", "5208707", 300_000, { evolucao12m: [500_000], ultimaCompra: "2026-03-10" }),
  cliente("c", "5201405", 100_000, { evolucao12m: [100_000] }),
  cliente("d", "5218805", 50_000),
  // Sem o código no cadastro: fica fora do mapa.
  cliente("e", null, 999_000),
];

const SEM_ANALISES: Pick<Analises, "pararam" | "menos" | "mix" | "novos"> = { pararam: [], menos: [], mix: [], novos: [] };

describe("montarTerritorio", () => {
  const acoes = new Map([
    ["b", { parado: { perdaPorMes: 2_000, diasSemComprar: 222 } }],
    ["d", { atrasado: { diasSemComprar: 50, cicloDias: 30, mediaPorMes: 500 }, mix: { familias: ["FLEXIL"] } }],
  ]);
  const territorio = montarTerritorio(MAPA, CLIENTES, acoes);
  const regiao = (codigo: string) => territorio.regioes.find((r) => r.regiao.codigo === codigo);

  it("soma a receita, a de 1 ano antes e os clientes de cada município, sem o cliente sem município", () => {
    expect(territorio.receita).toBe(1_050_000);
    expect(territorio.clientes).toBe(4);
    expect(territorio.municipios.get("5208707")).toMatchObject({ receita: 900_000, receitaAnoAntes: 1_000_000 });
  });

  it("guarda a compra mais recente do município, para as cidades esquecidas", () => {
    expect(territorio.municipios.get("5208707")?.ultimaCompra).toBe("2026-10-01");
    expect(territorio.municipios.get("5201405")?.ultimaCompra).toBeNull();
  });

  it("dá a cada região a parte da receita do estado, com os municípios do que mais fatura ao que menos", () => {
    expect(regiao("520001")).toMatchObject({ populacao: 1_400_000, receita: 1_000_000, clientes: 3 });
    expect(regiao("520001")?.participacao).toBeCloseTo(1_000_000 / 1_050_000);
    expect(regiao("520001")?.municipios.map((presenca) => presenca.municipio.nome)).toEqual(["Goiânia", "Aparecida de Goiânia"]);
  });

  it("soma as ações e o dinheiro em jogo no município, na região e no estado", () => {
    expect(territorio.municipios.get("5208707")?.acoes).toMatchObject({ emJogoPorMes: 2_000, parados: 1 });
    expect(regiao("520002")?.acoes).toMatchObject({ emJogoPorMes: 500, atrasados: 1, comMix: 1 });
    expect(territorio.acoes).toMatchObject({ emJogoPorMes: 2_500, parados: 1, atrasados: 1, comMix: 1, emRisco: 0, novos: 0 });
  });

  it("mede o potencial pela receita por habitante da área: a região fraca fica com a lacuna", () => {
    expect(territorio.receitaPorHabitante).toBeCloseTo(RECEITA_POR_HABITANTE);
    expect(regiao("520002")?.potencial).toBeCloseTo(250_000 * RECEITA_POR_HABITANTE);
    expect(regiao("520002")?.lacuna).toBeCloseTo(250_000 * RECEITA_POR_HABITANTE - 50_000);
    expect(regiao("520001")?.lacuna).toBe(0);
  });

  it("põe na área a vizinha sem cliente, com todo o potencial a conquistar e as cidades sem cliente", () => {
    expect(regiao("520003")).toMatchObject({ isDaArea: true, receita: 0, clientes: 0 });
    expect(regiao("520003")?.lacuna).toBeCloseTo(400_000 * RECEITA_POR_HABITANTE);
    expect(regiao("520003")?.semCliente.map((municipio) => municipio.nome)).toEqual(["Anápolis"]);
  });

  it("deixa fora da área, sem potencial, a região sem cliente nem vizinha com cliente", () => {
    expect(regiao("520004")).toMatchObject({ isDaArea: false, potencial: 0, lacuna: 0 });
  });

  it("conta quantos municípios fazem 80% da receita", () => {
    expect(territorio.municipiosPara80).toBe(1);
  });
});

describe("acoesDaCarteira", () => {
  it("usa a perda mensal de quem parou e a queda por mês de quem está comprando menos", () => {
    const acoes = acoesDaCarteira([], {
      ...SEM_ANALISES,
      pararam: [{ cliente: cliente("p", null, 0), diasSemComprar: 200, cicloDias: 30, perdaMensal: 3_000 }],
      menos: [{ cliente: cliente("m", null, 0), semestre: 4_000, semestreAnoAnterior: 10_000, variacao: -0.6, variacaoPecas: null }],
    }, HOJE);
    expect(acoes.get("p")).toEqual({ parado: { perdaPorMes: 3_000, diasSemComprar: 200 } });
    expect(acoes.get("m")).toEqual({ emRisco: { quedaPorMes: 1_000, variacao: -0.6 } });
  });

  it("divide o dinheiro do grupo entre os CNPJs pela parte de cada um no faturado, ou igual se ele não faturou", () => {
    const grupo = { ...cliente("g", null, 40_000), cnpjs: [cliente("g1", "5208707", 30_000), cliente("g2", "5211909", 10_000)] };
    const parado = { ...cliente("h", null, 0), cnpjs: [cliente("h1", "5208707", 0), cliente("h2", "5211909", 0)] };
    const acoes = acoesDaCarteira([], {
      ...SEM_ANALISES,
      pararam: [{ cliente: parado, diasSemComprar: 200, cicloDias: 30, perdaMensal: 2_000 }],
      menos: [{ cliente: grupo, semestre: 4_000, semestreAnoAnterior: 10_000, variacao: -0.6, variacaoPecas: null }],
    }, HOJE);
    expect([...acoes.entries()].map(([codigo, acao]) => [codigo, emJogoPorMes(acao)]).sort()).toEqual([
      ["g1", 750],
      ["g2", 250],
      ["h1", 1_000],
      ["h2", 1_000],
    ]);
  });

  it("marca o cliente ativo que passou do próprio ciclo, com a média mensal dele em jogo", () => {
    const atrasado = cliente("t", "5208707", 120_000, { cicloDias: 30, ultimaCompra: "2026-09-01" });
    const emDia = cliente("u", "5208707", 120_000, { cicloDias: 60, ultimaCompra: "2026-09-01" });
    const irregular = cliente("v", "5208707", 120_000, { ultimaCompra: "2026-01-01" });
    const acoes = acoesDaCarteira([atrasado, emDia, irregular], SEM_ANALISES, HOJE);
    expect(acoes.get("t")).toEqual({ atrasado: { diasSemComprar: 47, cicloDias: 30, mediaPorMes: 10_000 } });
    expect(acoes.has("u")).toBe(false);
    expect(acoes.has("v")).toBe(false);
  });

  it("não marca como atrasado quem já está parado ou em risco", () => {
    const emRisco = cliente("r", "5208707", 120_000, { cicloDias: 30, ultimaCompra: "2026-09-01" });
    const acoes = acoesDaCarteira([emRisco], {
      ...SEM_ANALISES,
      menos: [{ cliente: emRisco, semestre: 4_000, semestreAnoAnterior: 10_000, variacao: -0.6, variacaoPecas: null }],
    }, HOJE);
    expect(acoes.get("r")?.atrasado).toBeUndefined();
  });

  it("junta o mix e o novo às outras ações do mesmo cliente", () => {
    const novo = cliente("n", "5208707", 10_000);
    const acoes = acoesDaCarteira([novo], {
      ...SEM_ANALISES,
      mix: [{ cliente: novo, porte: "pequeno", oportunidades: [{ familia: "FLEXIL", penetracao: 0.6 }] }],
      novos: [{ cliente: novo, tipo: "novo", desde: "2026-08-10", faturadoDesde: 10_000 }],
    }, HOJE);
    expect(acoes.get("n")).toEqual({ mix: { familias: ["FLEXIL"] }, novo: { tipo: "novo", desde: "2026-08-10" } });
    expect(gravidadeDoCliente(acoes.get("n"))).toBe("oportunidade");
  });
});

describe("gravidadeDoCliente", () => {
  it("põe o parado acima de tudo e o em risco e o atrasado na atenção", () => {
    expect(gravidadeDoCliente({ parado: { perdaPorMes: 1, diasSemComprar: 1 }, mix: { familias: [] } })).toBe("critico");
    expect(gravidadeDoCliente({ atrasado: { diasSemComprar: 40, cicloDias: 30, mediaPorMes: 1 } })).toBe("atencao");
    expect(gravidadeDoCliente(undefined)).toBeNull();
  });
});

describe("direcaoDaReceita", () => {
  it("diz se a receita cresce ou cai, com 10% de folga para cada lado", () => {
    expect(direcaoDaReceita(110, 100)).toBe("alta");
    expect(direcaoDaReceita(95, 100)).toBe("estavel");
    expect(direcaoDaReceita(90, 100)).toBe("queda");
  });

  it("conta como alta a receita que veio do zero", () => {
    expect(direcaoDaReceita(500, 0)).toBe("alta");
    expect(direcaoDaReceita(0, 0)).toBe("estavel");
  });
});

describe("faixaDeRecencia", () => {
  it("reparte os dias sem compra em até 30, até 90, até 180 e acima, com a cidade sem compra na última", () => {
    expect([10, 30, 31, 90, 91, 180, 181].map(faixaDeRecencia)).toEqual([1, 1, 2, 2, 3, 3, 4]);
    expect(faixaDeRecencia(null)).toBe(4);
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
