import { describe, expect, it } from "vitest";
import { localizarNoMunicipio, type EnderecoParaLocalizar } from "./cnefe.ts";
import { chaveDaRua } from "./endereco.ts";

const CABECALHO = "CEP;NOM_TIPO_SEGLOGR;NOM_TITULO_SEGLOGR;NOM_SEGLOGR;NUM_ENDERECO;LATITUDE;LONGITUDE;NV_GEO_COORD";

/** Uma linha do CSV do CNEFE, só com as colunas que a busca lê. */
function linha(cep: string, tipo: string, titulo: string, nome: string, numero: number, latitude: number, longitude: number, nivel = 1): string {
  return [cep, tipo, titulo, nome, numero, latitude, longitude, nivel].join(";");
}

async function* csv(...linhas: string[]) {
  yield CABECALHO;
  yield* linhas;
}

const RUA_DO_CENTRO = [
  linha("85010100", "RUA", "DOUTOR", "JOAO DA SILVA", 100, -25.1, -50.1),
  linha("85010100", "RUA", "DOUTOR", "JOAO DA SILVA", 100, -25.3, -50.3),
  linha("85010100", "RUA", "DOUTOR", "JOAO DA SILVA", 100, -25.2, -50.2),
  linha("85010100", "RUA", "DOUTOR", "JOAO DA SILVA", 140, -25.4, -50.4),
  linha("85010100", "RUA", "", "DAS FLORES", 7, -25.5, -50.5),
];

function pedido(rua: string, numero: number | null, cep: string | null = "85010100"): EnderecoParaLocalizar {
  return { chave: "cliente", cep, rua: chaveDaRua(rua), numero };
}

async function localizar(endereco: EnderecoParaLocalizar, ...linhas: string[]) {
  return (await localizarNoMunicipio(csv(...linhas), [endereco])).get("cliente");
}

describe("localizarNoMunicipio", () => {
  it("acha o mesmo número na mesma rua, pela mediana dos endereços dele", async () => {
    expect(await localizar(pedido("R DR JOAO DA SILVA", 100), ...RUA_DO_CENTRO)).toEqual({ latitude: -25.2, longitude: -50.2, precisao: "numero" });
  });

  it("acha o número no CEP quando a rua está escrita diferente no ERP", async () => {
    expect(await localizar(pedido("RUA JOAO SYLVA", 140), ...RUA_DO_CENTRO)).toMatchObject({ latitude: -25.4, precisao: "numero" });
  });

  it("sem o número no IBGE, vai para o número mais perto da mesma rua", async () => {
    expect(await localizar(pedido("R DR JOAO DA SILVA", 130), ...RUA_DO_CENTRO)).toMatchObject({ latitude: -25.4, precisao: "rua" });
  });

  it("sem número, fica no meio da rua; com a rua desconhecida, no meio do CEP", async () => {
    expect(await localizar(pedido("RUA DAS FLORES", null), ...RUA_DO_CENTRO)).toMatchObject({ latitude: -25.5, precisao: "rua" });
    expect(await localizar(pedido("AV BRASIL", 10), ...RUA_DO_CENTRO)).toMatchObject({ precisao: "cep" });
  });

  it("o CEP da cidade toda não vale como ponto, e a rua de mesmo nome no CEP do cliente vence a de outro bairro", async () => {
    expect(await localizar(pedido("AV BRASIL", 10, "85640000"), linha("85640000", "AVENIDA", "", "PARANA", 1, -25, -50))).toBeNull();
    const outroBairro = linha("85020200", "RUA", "", "DAS FLORES", 7, -26, -51);
    expect(await localizar(pedido("RUA DAS FLORES", 7), outroBairro, ...RUA_DO_CENTRO)).toMatchObject({ latitude: -25.5, precisao: "numero" });
  });

  it("não usa a coordenada da localidade ou do setor para dizer onde fica o número", async () => {
    const doSetor = linha("85010100", "RUA", "", "DAS ACACIAS", 50, -25.9, -50.9, 6);
    expect(await localizar(pedido("RUA DAS ACACIAS", 50), doSetor)).toMatchObject({ precisao: "rua" });
  });
});
