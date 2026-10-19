import { describe, expect, it } from "vitest";
import { DETALHE_DA_CIDADE, projetarNaCidade, type MapaDaCidade, type MunicipioDoMapa } from "dominio/mapa";
import { caixaDaCidade, caixaDoCaminho, clientesNaCidade } from "./cidade";
import type { AcoesDoCliente } from "./mapa";
import type { ClienteResumo, EnderecoDoCliente } from "./tipos";

function cliente(codigo: string, faturamento12m: number, endereco: EnderecoDoCliente | null): ClienteResumo {
  return {
    codigo,
    codigoErp: endereco ? codigo : null,
    nome: `Cliente ${codigo}`,
    cidade: "CURITIBA",
    uf: "PR",
    municipio: "4106902",
    endereco,
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
  };
}

const NO_CENTRO: EnderecoDoCliente = { texto: "R XV DE NOVEMBRO, 1200", bairro: "CENTRO", cep: "80020310", ponto: { latitude: -25.43, longitude: -49.27, precisao: "numero" } };
const SEM_PONTO: EnderecoDoCliente = { ...NO_CENTRO, ponto: null };

describe("clientesNaCidade", () => {
  it("põe a empresa no ponto do endereço, na cor da ação mais grave, da que mais fatura à que menos", () => {
    const acoes = new Map<string, AcoesDoCliente>([["parado", { parado: { perdaPorMes: 500, diasSemComprar: 120 } }]]);
    const { comPonto } = clientesNaCidade([cliente("em-dia", 1_000, NO_CENTRO), cliente("parado", 9_000, NO_CENTRO)], acoes);
    expect(comPonto.map(({ cliente: { codigo }, tom }) => [codigo, tom])).toEqual([
      ["parado", "critico"],
      ["em-dia", "em_dia"],
    ]);
    expect(comPonto[0]?.ponto).toEqual(projetarNaCidade(-49.27, -25.43));
  });

  it("separa a pessoa física e o endereço que o IBGE não achou", () => {
    const { comPonto, semPonto } = clientesNaCidade([cliente("pessoa-fisica", 1, null), cliente("nao-achou", 1, SEM_PONTO)], new Map());
    expect(comPonto).toEqual([]);
    expect(semPonto.map(({ codigo }) => codigo)).toEqual(["pessoa-fisica", "nao-achou"]);
  });
});

describe("caixaDaCidade", () => {
  const municipio: MunicipioDoMapa = { codigo: "4106902", nome: "Curitiba", regiao: "410001", populacao: null, mercado: null, d: "M10 20l5 0 0 5 -5 0zM30 40l1 1z", centro: [12, 22] };

  it("usa o desenho da cidade, na unidade do estado", () => {
    const cidade: MapaDaCidade = { codigo: "4106902", caixa: [200, 400, 300, 500], contorno: "", divisoes: null };
    expect(caixaDaCidade(cidade, municipio)).toEqual([200 / DETALHE_DA_CIDADE, 400 / DETALHE_DA_CIDADE, 300 / DETALHE_DA_CIDADE, 500 / DETALHE_DA_CIDADE]);
  });

  it("sem o desenho, mede o caminho do município no mapa do estado, com todos os pedaços", () => {
    expect(caixaDaCidade(null, municipio)).toEqual([10, 20, 31, 41]);
    expect(caixaDoCaminho("M-5 -5l10 10z")).toEqual([-5, -5, 5, 5]);
  });
});
