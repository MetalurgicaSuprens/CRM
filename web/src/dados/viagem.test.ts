import { afterEach, describe, expect, it, vi } from "vitest";
import { projetar, type MapaDaUf, type MunicipioDoMapa } from "dominio/mapa";
import { gravarRoteiro, lerRoteiro, linkDoGoogleMaps, municipioMaisPerto, ordenarParadas, pertoDe, trechosDoRoteiro } from "./viagem";

function municipio(codigo: string, nome: string, longitude: number, latitude: number): MunicipioDoMapa {
  return { codigo, nome, regiao: "410001", populacao: 100_000, d: "", centro: projetar(longitude, latitude) };
}

const CURITIBA = municipio("4106902", "Curitiba", -49.27, -25.43);
const PONTA_GROSSA = municipio("4119905", "Ponta Grossa", -50.16, -25.09);
const LONDRINA = municipio("4113700", "Londrina", -51.16, -23.31);
const MARINGA = municipio("4115200", "Maringá", -51.94, -23.42);
const CASCAVEL = municipio("4104808", "Cascavel", -53.46, -24.96);
const PARANA: MapaDaUf = { uf: "PR", nome: "Paraná", caixa: [0, 0, 1, 1], contorno: "", regioes: [], municipios: [CURITIBA, PONTA_GROSSA, LONDRINA, MARINGA, CASCAVEL] };
const parada = (doMapa: MunicipioDoMapa) => ({ municipio: doMapa, uf: "PR" });

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

describe("lerRoteiro e gravarRoteiro", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("guarda os códigos no aparelho e devolve só o que é código de município", () => {
    const guardado = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (chave: string) => guardado.get(chave) ?? null, setItem: (chave: string, valor: string) => guardado.set(chave, valor) });
    gravarRoteiro(["4106902", "4119905"]);
    expect(lerRoteiro()).toEqual(["4106902", "4119905"]);
    guardado.set("crm:roteiro", JSON.stringify(["4106902", "<script>", 42]));
    expect(lerRoteiro()).toEqual(["4106902"]);
  });

  it("sem armazenamento, começa vazio e não quebra", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(lerRoteiro()).toEqual([]);
    expect(() => gravarRoteiro(["4106902"])).not.toThrow();
  });
});
