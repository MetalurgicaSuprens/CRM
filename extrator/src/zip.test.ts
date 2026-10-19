import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { lerArquivoDoZip, lerLinhasDoZip } from "./zip.ts";
import { criarZip, criarZipComArquivos } from "./zipDeTeste.ts";

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "crm-zip-"));
afterAll(() => fs.rmSync(pasta, { recursive: true, force: true }));

async function todas(linhas: AsyncIterable<string>): Promise<string[]> {
  const lidas: string[] = [];
  for await (const linha of linhas) lidas.push(linha);
  return lidas;
}

describe("lerLinhasDoZip", () => {
  it("lê linha a linha o arquivo comprimido do zip, com acento e quebra do Windows", async () => {
    const caminho = criarZip(pasta, "enderecos.csv", "CEP;NUM\r\n01310100;1200\r\nSÃO;2\r\n", 8);
    expect(await todas(lerLinhasDoZip(caminho))).toEqual(["CEP;NUM", "01310100;1200", "SÃO;2"]);
  });

  it("lê também o arquivo guardado sem compressão", async () => {
    const caminho = criarZip(pasta, "guardado.csv", "a\nb\n", 0);
    expect(await todas(lerLinhasDoZip(caminho))).toEqual(["a", "b"]);
  });

  it("acha pelo final do nome o arquivo de um zip com vários, como o shapefile dos bairros", () => {
    const caminho = criarZipComArquivos(path.join(pasta, "bairros.zip"), { "BR_bairros.shp": Buffer.from([1, 2, 3]), "BR_bairros.dbf": "atributos" });
    expect([...lerArquivoDoZip(caminho, ".shp")]).toEqual([1, 2, 3]);
    expect(lerArquivoDoZip(caminho, ".DBF").toString("utf8")).toBe("atributos");
    expect(() => lerArquivoDoZip(caminho, ".prj")).toThrow(/nenhum arquivo terminado em .prj/);
  });

  it("recusa o que não é zip", () => {
    const caminho = path.join(pasta, "nao-e-zip.zip");
    fs.writeFileSync(caminho, "texto qualquer");
    expect(() => lerLinhasDoZip(caminho)).toThrow(/não é um zip/);
  });
});
