import { afterEach, describe, expect, it, vi } from "vitest";
import { projetar, type MapaDaUf, type MunicipioDoMapa } from "dominio/mapa";
import type { ClienteResumo } from "./tipos";
import { gravarRoteiro, lerRoteiro, linkDoEnderecoNoGoogleMaps, linkDoGoogleMaps, municipioMaisPerto, ordenarParadas, pertoDe, pontoDaParada, trechosDoRoteiro } from "./viagem";

function municipio(codigo: string, nome: string, longitude: number, latitude: number): MunicipioDoMapa {
  return { codigo, nome, regiao: "410001", populacao: 100_000, mercado: null, d: "", centro: projetar(longitude, latitude) };
}

const CURITIBA = municipio("4106902", "Curitiba", -49.27, -25.43);
const PONTA_GROSSA = municipio("4119905", "Ponta Grossa", -50.16, -25.09);
const LONDRINA = municipio("4113700", "Londrina", -51.16, -23.31);
const MARINGA = municipio("4115200", "Maringá", -51.94, -23.42);
const CASCAVEL = municipio("4104808", "Cascavel", -53.46, -24.96);
const PARANA: MapaDaUf = { uf: "PR", nome: "Paraná", caixa: [0, 0, 1, 1], contorno: "", regioes: [], municipios: [CURITIBA, PONTA_GROSSA, LONDRINA, MARINGA, CASCAVEL] };
const parada = (doMapa: MunicipioDoMapa) => ({ municipio: doMapa, uf: "PR" });

/** Uma empresa de Curitiba, no endereço dela, perto de Ponta Grossa. */
const NA_SAIDA_PARA_PONTA_GROSSA = {
  codigo: "0123456789abcdef",
  nome: "AUTO PECAS DO TREVO",
  endereco: { texto: "ROD BR 277, 1000", bairro: "CIDADE INDUSTRIAL", cep: "81450000", ponto: { latitude: -25.38, longitude: -49.6, precisao: "rua" as const } },
} as ClienteResumo;

describe("municipioMaisPerto", () => {
  it("acha o município mais perto do ponto e o estado dele", () => {
    const perto = municipioMaisPerto(projetar(-49.3, -25.4), [PARANA]);
    expect(perto?.municipio.nome).toBe("Curitiba");
    expect(perto?.uf).toBe("PR");
    expect(perto?.distanciaKm).toBeLessThan(5);
  });
});

describe("pertoDe", () => {
  it("dá os lugares dentro do raio, do mais perto ao mais longe", () => {
    const lugares = pertoDe(CURITIBA.centro, [CASCAVEL, PONTA_GROSSA, CURITIBA].map(parada), 150);
    expect(lugares.map(({ municipio: { nome } }) => nome)).toEqual(["Curitiba", "Ponta Grossa"]);
    expect(lugares[1]?.distanciaKm).toBeGreaterThan(90);
  });
});

describe("ordenarParadas", () => {
  it("vai sempre à parada mais perto que falta, a partir de onde o representante está", () => {
    const ordem = ordenarParadas([CASCAVEL, LONDRINA, PONTA_GROSSA, MARINGA].map(parada), CURITIBA.centro);
    expect(ordem.map(({ municipio: { nome } }) => nome)).toEqual(["Ponta Grossa", "Londrina", "Maringá", "Cascavel"]);
  });

  it("sem a posição, parte da primeira parada escolhida", () => {
    const ordem = ordenarParadas([MARINGA, CASCAVEL, LONDRINA].map(parada), null);
    expect(ordem.map(({ municipio: { nome } }) => nome)).toEqual(["Maringá", "Londrina", "Cascavel"]);
  });
});

describe("a parada no cliente", () => {
  it("fica no endereço do cliente, e sem ponto, no meio da cidade", () => {
    expect(pontoDaParada({ municipio: CURITIBA, cliente: NA_SAIDA_PARA_PONTA_GROSSA })).toEqual(projetar(-49.6, -25.38));
    expect(pontoDaParada({ municipio: CURITIBA, cliente: { ...NA_SAIDA_PARA_PONTA_GROSSA, endereco: null } })).toEqual(CURITIBA.centro);
  });

  it("entra na ordem pelo endereço, e o Google recebe o endereço do cliente", () => {
    const cliente = { municipio: CURITIBA, uf: "PR", cliente: NA_SAIDA_PARA_PONTA_GROSSA };
    const ordem = ordenarParadas([parada(PONTA_GROSSA), cliente], projetar(-49.27, -25.43));
    expect(ordem.map(({ municipio: { nome } }) => nome)).toEqual(["Curitiba", "Ponta Grossa"]);
    const link = new URL(linkDoGoogleMaps(ordem) ?? "");
    expect(link.searchParams.get("waypoints")).toBe("ROD BR 277, 1000, Curitiba - PR, 81450-000, Brasil");
  });
});

describe("trechosDoRoteiro", () => {
  it("mede de onde parte até a primeira parada e de uma parada à outra", () => {
    const [primeiro, segundo] = trechosDoRoteiro([PONTA_GROSSA, LONDRINA].map(parada), CURITIBA.centro);
    expect(primeiro).toBeGreaterThan(90);
    expect(segundo).toBeGreaterThan(200);
  });

  it("sem a posição, o primeiro trecho é zero", () => {
    expect(trechosDoRoteiro([PONTA_GROSSA].map(parada), null)).toEqual([0]);
  });
});

describe("linkDoGoogleMaps", () => {
  it("leva as cidades na ordem, a última como destino, sem a origem", () => {
    const link = new URL(linkDoGoogleMaps([PONTA_GROSSA, LONDRINA, MARINGA].map(parada)) ?? "");
    expect(link.origin + link.pathname).toBe("https://www.google.com/maps/dir/");
    expect(link.searchParams.get("destination")).toBe("Maringá, PR, Brasil");
    expect(link.searchParams.get("waypoints")).toBe("Ponta Grossa, PR, Brasil|Londrina, PR, Brasil");
    expect(link.searchParams.has("origin")).toBe(false);
  });

  it("não monta link sem parada", () => {
    expect(linkDoGoogleMaps([])).toBeNull();
  });
});

describe("linkDoEnderecoNoGoogleMaps", () => {
  it("procura o endereço com a cidade e o CEP", () => {
    const link = new URL(linkDoEnderecoNoGoogleMaps({ texto: "R XV DE NOVEMBRO, 1200", cep: "80020310" }, "CURITIBA", "PR"));
    expect(link.origin + link.pathname).toBe("https://www.google.com/maps/search/");
    expect(link.searchParams.get("query")).toBe("R XV DE NOVEMBRO, 1200, CURITIBA - PR, 80020-310, Brasil");
  });
});

describe("lerRoteiro e gravarRoteiro", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("guarda os códigos no aparelho e devolve só o que é código de município ou id de cliente", () => {
    const guardado = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (chave: string) => guardado.get(chave) ?? null, setItem: (chave: string, valor: string) => guardado.set(chave, valor) });
    gravarRoteiro(["4106902", "4119905"]);
    expect(lerRoteiro()).toEqual(["4106902", "4119905"]);
    guardado.set("crm:roteiro", JSON.stringify(["4106902", "<script>", 42, "0123456789abcdef"]));
    expect(lerRoteiro()).toEqual(["4106902", "0123456789abcdef"]);
  });

  it("sem armazenamento, começa vazio e não quebra", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(lerRoteiro()).toEqual([]);
    expect(() => gravarRoteiro(["4106902"])).not.toThrow();
  });
});
