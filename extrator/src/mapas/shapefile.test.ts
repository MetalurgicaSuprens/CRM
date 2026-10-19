import { describe, expect, it } from "vitest";
import { lerPoligonosDoShp, lerRegistrosDoDbf } from "./shapefile.ts";

/** Um .shp de polígonos com os registros dados (cada um, os anéis), no formato da ESRI. */
function criarShp(registros: (number[][][] | null)[]): Buffer {
  const conteudos = registros.map((aneis) => {
    if (!aneis) {
      const vazio = Buffer.alloc(4);
      vazio.writeInt32LE(0, 0);
      return vazio;
    }
    const pontos = aneis.flat();
    const conteudo = Buffer.alloc(44 + aneis.length * 4 + pontos.length * 16);
    conteudo.writeInt32LE(5, 0);
    conteudo.writeInt32LE(aneis.length, 36);
    conteudo.writeInt32LE(pontos.length, 40);
    let comeco = 0;
    aneis.forEach((anel, i) => {
      conteudo.writeInt32LE(comeco, 44 + i * 4);
      comeco += anel.length;
    });
    pontos.forEach(([x, y], i) => {
      conteudo.writeDoubleLE(x ?? 0, 44 + aneis.length * 4 + i * 16);
      conteudo.writeDoubleLE(y ?? 0, 44 + aneis.length * 4 + i * 16 + 8);
    });
    return conteudo;
  });
  const cabecalho = Buffer.alloc(100);
  const tamanho = 100 + conteudos.reduce((soma, conteudo) => soma + 8 + conteudo.length, 0);
  cabecalho.writeInt32BE(9994, 0);
  cabecalho.writeInt32BE(tamanho / 2, 24);
  cabecalho.writeInt32LE(1000, 28);
  cabecalho.writeInt32LE(5, 32);
  const partes = conteudos.flatMap((conteudo, i) => {
    const registro = Buffer.alloc(8);
    registro.writeInt32BE(i + 1, 0);
    registro.writeInt32BE(conteudo.length / 2, 4);
    return [registro, conteudo];
  });
  return Buffer.concat([cabecalho, ...partes]);
}

/** Um .dbf com campos de texto, os registros na ordem. */
function criarDbf(campos: [string, number][], registros: string[][]): Buffer {
  const tamanhoDoCabecalho = 32 + campos.length * 32 + 1;
  const tamanhoDoRegistro = 1 + campos.reduce((soma, [, tamanho]) => soma + tamanho, 0);
  const cabecalho = Buffer.alloc(tamanhoDoCabecalho);
  cabecalho.writeUInt8(3, 0);
  cabecalho.writeUInt32LE(registros.length, 4);
  cabecalho.writeUInt16LE(tamanhoDoCabecalho, 8);
  cabecalho.writeUInt16LE(tamanhoDoRegistro, 10);
  campos.forEach(([nome, tamanho], i) => {
    cabecalho.write(nome, 32 + i * 32, "latin1");
    cabecalho.write("C", 32 + i * 32 + 11, "latin1");
    cabecalho.writeUInt8(tamanho, 32 + i * 32 + 16);
  });
  cabecalho.writeUInt8(0x0d, tamanhoDoCabecalho - 1);
  const linhas = registros.map((valores) => {
    const linha = Buffer.alloc(tamanhoDoRegistro, " ");
    let posicao = 1;
    valores.forEach((valor, i) => {
      linha.write(valor, posicao, "utf8");
      posicao += campos[i]?.[1] ?? 0;
    });
    return linha;
  });
  return Buffer.concat([cabecalho, ...linhas]);
}

describe("lerPoligonosDoShp", () => {
  it("lê os anéis de cada polígono, com o buraco, e o registro vazio como null", () => {
    const externo = [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]];
    const buraco = [[2, 2], [8, 2], [8, 8], [2, 8], [2, 2]];
    expect(lerPoligonosDoShp(criarShp([[externo, buraco], null]))).toEqual([[externo, buraco], null]);
  });
});

describe("lerRegistrosDoDbf", () => {
  it("lê os campos pedidos sem o preenchimento, com acento", () => {
    const dbf = criarDbf([["CD_MUN", 7], ["NM_BAIRRO", 20]], [["4106902", "Água Verde"], ["4106902", "Centro"]]);
    expect(lerRegistrosDoDbf(dbf, ["NM_BAIRRO", "CD_MUN"])).toEqual([
      { NM_BAIRRO: "Água Verde", CD_MUN: "4106902" },
      { NM_BAIRRO: "Centro", CD_MUN: "4106902" },
    ]);
  });

  it("recusa o campo que o arquivo não tem", () => {
    expect(() => lerRegistrosDoDbf(criarDbf([["CD_MUN", 7]], []), ["NM_BAIRRO"])).toThrow(/não tem os campos NM_BAIRRO/);
  });
});
