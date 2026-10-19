import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { ClienteDaCarteira } from "../erp/tipos.ts";
import { criarZip } from "../zipDeTeste.ts";
import { localizarClientes } from "./localizarClientes.ts";

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "crm-localizacao-"));
afterAll(() => fs.rmSync(pasta, { recursive: true, force: true }));

function cliente(numero: number, parcial: Partial<ClienteDaCarteira>): ClienteDaCarteira {
  return {
    chave: `1/${numero}`,
    empresa: 1,
    cliente: numero,
    isPessoaFisica: false,
    fantasia: `CLIENTE ${numero}`,
    razaoSocial: `CLIENTE ${numero} LTDA`,
    cidade: "CURITIBA",
    uf: "PR",
    municipio: "4106902",
    endereco: { texto: "R XV DE NOVEMBRO, 1200 SALA 3", bairro: "CENTRO", cep: "80020310" },
    ponto: null,
    mercado: "PRACA",
    representante: "1302",
    status: "ativo",
    grupo: null,
    ...parcial,
  };
}

const CSV_DE_CURITIBA = [
  "CEP;NOM_TIPO_SEGLOGR;NOM_TITULO_SEGLOGR;NOM_SEGLOGR;NUM_ENDERECO;LATITUDE;LONGITUDE;NV_GEO_COORD",
  "80020310;RUA;;XV DE NOVEMBRO;1200;-25.43;-49.27;1",
].join("\n");

function fontes(nome: string) {
  const pastaDoCnefe = path.join(pasta, nome, "cnefe");
  fs.mkdirSync(pastaDoCnefe, { recursive: true });
  return { pastaDoCnefe, arquivoDosPontos: path.join(pasta, nome, "pontos.db") };
}

describe("localizarClientes", () => {
  it("põe o ponto do CNEFE na empresa e guarda o endereço buscado para a próxima foto", async () => {
    const onde = fontes("guarda");
    const arquivo = criarZip(onde.pastaDoCnefe, "4106902_CURITIBA.csv", CSV_DE_CURITIBA);
    const primeira = await localizarClientes([cliente(1, {})], onde);
    expect(primeira.carteira[0]?.ponto).toEqual({ latitude: -25.43, longitude: -49.27, precisao: "numero" });
    expect(primeira.resumo).toMatchObject({ comPonto: 1, buscados: 1 });
    fs.rmSync(arquivo);
    const segunda = await localizarClientes([cliente(1, {})], onde);
    expect(segunda.carteira[0]?.ponto).toEqual(primeira.carteira[0]?.ponto);
    expect(segunda.resumo).toMatchObject({ comPonto: 1, buscados: 0 });
  });

  it("deixa sem ponto quem não tem endereço ou município, e avisa o município sem o arquivo do CNEFE", async () => {
    const onde = fontes("sem-arquivo");
    const { carteira, resumo } = await localizarClientes(
      [cliente(1, { endereco: null }), cliente(2, { municipio: null }), cliente(3, { municipio: "4113700" })],
      onde,
    );
    expect(carteira.map(({ ponto }) => ponto)).toEqual([null, null, null]);
    expect(resumo).toMatchObject({ comPonto: 0, semPonto: 3, municipiosSemArquivo: ["4113700"] });
  });
});
