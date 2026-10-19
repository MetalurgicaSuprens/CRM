import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

/*
 * Só para os testes: grava um zip mínimo, como os do IBGE: para cada arquivo, o cabeçalho local e os
 * dados; depois o diretório e o fim.
 */

/** Um zip com um arquivo só, como o do CNEFE. */
export function criarZip(pasta: string, nome: string, conteudo: string, metodo: 0 | 8 = 8): string {
  return criarZipComArquivos(path.join(pasta, `${nome}-${metodo}.zip`), { [nome]: conteudo }, metodo);
}

export function criarZipComArquivos(caminho: string, arquivos: Record<string, string | Buffer>, metodo: 0 | 8 = 8): string {
  const locais: Buffer[] = [];
  const diretorio: Buffer[] = [];
  let posicao = 0;
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    const dados = typeof conteudo === "string" ? Buffer.from(conteudo, "utf8") : conteudo;
    const comprimido = metodo === 8 ? zlib.deflateRawSync(dados) : dados;
    const nomeEmBytes = Buffer.from(nome, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(metodo, 8);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(nomeEmBytes.length, 26);
    const entrada = Buffer.alloc(46);
    entrada.writeUInt32LE(0x02014b50, 0);
    entrada.writeUInt16LE(metodo, 10);
    entrada.writeUInt32LE(comprimido.length, 20);
    entrada.writeUInt32LE(dados.length, 24);
    entrada.writeUInt16LE(nomeEmBytes.length, 28);
    entrada.writeUInt32LE(posicao, 42);
    locais.push(local, nomeEmBytes, comprimido);
    diretorio.push(entrada, nomeEmBytes);
    posicao += local.length + nomeEmBytes.length + comprimido.length;
  }
  const tamanhoDoDiretorio = diretorio.reduce((soma, parte) => soma + parte.length, 0);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(Object.keys(arquivos).length, 8);
  fim.writeUInt16LE(Object.keys(arquivos).length, 10);
  fim.writeUInt32LE(tamanhoDoDiretorio, 12);
  fim.writeUInt32LE(posicao, 16);
  fs.writeFileSync(caminho, Buffer.concat([...locais, ...diretorio, fim]));
  return caminho;
}
