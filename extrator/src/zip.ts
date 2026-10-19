import fs from "node:fs";
import readline from "node:readline";
import zlib from "node:zlib";

/*
 * Os arquivos do IBGE vêm em zip: o CNEFE com um CSV só, que passa de 1 GB aberto na capital de São
 * Paulo, e a malha de bairros com as partes do shapefile. Este leitor abre o zip direto, sem
 * descompactar no disco e sem pacote novo. Formato: PKWARE APPNOTE, só o que o IBGE usa (deflate ou
 * guardado, sem ZIP64).
 */

const ASSINATURA_DO_FIM = 0x06054b50;
const ASSINATURA_DO_DIRETORIO = 0x02014b50;
const ASSINATURA_DO_ARQUIVO = 0x04034b50;
const TAMANHO_DO_FIM = 22;
const TAMANHO_DA_ENTRADA_NO_DIRETORIO = 46;
/** O fim do zip pode ter um comentário de até 64 KB. */
const MAIOR_COMENTARIO = 0xffff;
const GUARDADO = 0;
const DEFLATE = 8;

type Entrada = { nome: string; inicio: number; tamanho: number; metodo: number };

/** As linhas do primeiro arquivo do zip, em UTF-8, uma por vez. */
export function lerLinhasDoZip(caminho: string): AsyncIterable<string> {
  const [entrada] = lerEntradas(caminho);
  if (!entrada) throw new Error(`${caminho}: zip vazio.`);
  const comprimido = fs.createReadStream(caminho, { start: entrada.inicio, end: entrada.inicio + entrada.tamanho - 1 });
  const aberto = entrada.metodo === DEFLATE ? comprimido.pipe(zlib.createInflateRaw()) : comprimido;
  comprimido.on("error", (erro) => aberto.destroy(erro));
  return readline.createInterface({ input: aberto.setEncoding("utf8"), crlfDelay: Infinity });
}

/** O arquivo do zip com o nome que termina em `final` (".shp", ".dbf"), inteiro na memória. */
export function lerArquivoDoZip(caminho: string, final: string): Buffer {
  const entrada = lerEntradas(caminho).find(({ nome }) => nome.toLowerCase().endsWith(final.toLowerCase()));
  if (!entrada) throw new Error(`${caminho}: nenhum arquivo terminado em ${final}.`);
  const arquivo = fs.openSync(caminho, "r");
  try {
    const comprimido = lerTrecho(arquivo, entrada.inicio, entrada.inicio + entrada.tamanho);
    return entrada.metodo === DEFLATE ? zlib.inflateRawSync(comprimido) : comprimido;
  } finally {
    fs.closeSync(arquivo);
  }
}

function lerEntradas(caminho: string): Entrada[] {
  const arquivo = fs.openSync(caminho, "r");
  try {
    const tamanhoDoZip = fs.fstatSync(arquivo).size;
    const fim = lerTrecho(arquivo, Math.max(0, tamanhoDoZip - TAMANHO_DO_FIM - MAIOR_COMENTARIO), tamanhoDoZip);
    const posicaoDoFim = fim.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (posicaoDoFim < 0 || fim.readUInt32LE(posicaoDoFim) !== ASSINATURA_DO_FIM) throw new Error(`${caminho} não é um zip.`);
    const quantas = fim.readUInt16LE(posicaoDoFim + 10);
    const tamanhoDoDiretorio = fim.readUInt32LE(posicaoDoFim + 12);
    const inicioDoDiretorio = fim.readUInt32LE(posicaoDoFim + 16);
    const diretorio = lerTrecho(arquivo, inicioDoDiretorio, inicioDoDiretorio + tamanhoDoDiretorio);
    const entradas: Entrada[] = [];
    let posicao = 0;
    for (let i = 0; i < quantas; i += 1) {
      if (diretorio.readUInt32LE(posicao) !== ASSINATURA_DO_DIRETORIO) throw new Error(`${caminho}: diretório do zip fora do formato.`);
      const metodo = diretorio.readUInt16LE(posicao + 10);
      const tamanho = diretorio.readUInt32LE(posicao + 20);
      const tamanhoDoNome = diretorio.readUInt16LE(posicao + 28);
      const tamanhoDoExtra = diretorio.readUInt16LE(posicao + 30);
      const tamanhoDoComentario = diretorio.readUInt16LE(posicao + 32);
      const cabecalho = diretorio.readUInt32LE(posicao + 42);
      const nome = diretorio.toString("utf8", posicao + TAMANHO_DA_ENTRADA_NO_DIRETORIO, posicao + TAMANHO_DA_ENTRADA_NO_DIRETORIO + tamanhoDoNome);
      if (metodo !== DEFLATE && metodo !== GUARDADO) throw new Error(`${caminho}: compressão ${metodo} não suportada em ${nome}.`);
      if (tamanho === 0xffffffff || cabecalho === 0xffffffff) throw new Error(`${caminho}: zip de mais de 4 GB (ZIP64) não suportado.`);
      entradas.push({ nome, inicio: inicioDosDados(arquivo, caminho, cabecalho), tamanho, metodo });
      posicao += TAMANHO_DA_ENTRADA_NO_DIRETORIO + tamanhoDoNome + tamanhoDoExtra + tamanhoDoComentario;
    }
    return entradas;
  } finally {
    fs.closeSync(arquivo);
  }
}

/** Os dados começam depois do cabeçalho local, que tem o nome e um extra de tamanho próprio. */
function inicioDosDados(arquivo: number, caminho: string, cabecalho: number): number {
  const local = lerTrecho(arquivo, cabecalho, cabecalho + 30);
  if (local.readUInt32LE(0) !== ASSINATURA_DO_ARQUIVO) throw new Error(`${caminho}: cabeçalho do arquivo não encontrado.`);
  return cabecalho + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
}

function lerTrecho(arquivo: number, de: number, ate: number): Buffer {
  const trecho = Buffer.alloc(ate - de);
  fs.readSync(arquivo, trecho, 0, trecho.length, de);
  return trecho;
}
