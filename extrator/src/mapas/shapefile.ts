/*
 * O shapefile da malha de bairros do Censo 2022 (geoftp.ibge.gov.br), lido só com o Buffer do Node:
 * do .shp, os polígonos; do .dbf, os atributos de cada um, na mesma ordem. Formato: ESRI Shapefile
 * Technical Description (1998), só o tipo polígono, o único da malha.
 */

/** Um polígono do .shp: os anéis, cada um com os pontos [longitude, latitude]. Null no registro vazio. */
export type PoligonoDoShp = number[][][] | null;

const TAMANHO_DO_CABECALHO = 100;
const SEM_FORMA = 0;
const POLIGONO = 5;

export function lerPoligonosDoShp(shp: Buffer): PoligonoDoShp[] {
  const tipoDoArquivo = shp.readInt32LE(32);
  if (tipoDoArquivo !== POLIGONO) throw new Error(`O shapefile não é de polígonos (tipo ${tipoDoArquivo}).`);
  const tamanhoDoArquivo = shp.readInt32BE(24) * 2;
  const poligonos: PoligonoDoShp[] = [];
  let posicao = TAMANHO_DO_CABECALHO;
  while (posicao < tamanhoDoArquivo) {
    const tamanhoDoConteudo = shp.readInt32BE(posicao + 4) * 2;
    poligonos.push(lerPoligono(shp, posicao + 8));
    posicao += 8 + tamanhoDoConteudo;
  }
  return poligonos;
}

function lerPoligono(shp: Buffer, inicio: number): PoligonoDoShp {
  const tipo = shp.readInt32LE(inicio);
  if (tipo === SEM_FORMA) return null;
  if (tipo !== POLIGONO) throw new Error(`Forma ${tipo} no meio dos polígonos.`);
  const partes = shp.readInt32LE(inicio + 36);
  const pontos = shp.readInt32LE(inicio + 40);
  const inicioDasPartes = inicio + 44;
  const inicioDosPontos = inicioDasPartes + partes * 4;
  const comecos = Array.from({ length: partes }, (_, i) => shp.readInt32LE(inicioDasPartes + i * 4));
  return comecos.map((comeco, i) => {
    const fim = comecos[i + 1] ?? pontos;
    return Array.from({ length: fim - comeco }, (_, j) => {
      const posicao = inicioDosPontos + (comeco + j) * 16;
      return [shp.readDoubleLE(posicao), shp.readDoubleLE(posicao + 8)];
    });
  });
}

/** Os campos pedidos de cada registro do .dbf, sem os espaços de preenchimento; o texto é UTF-8 (o .cpg da malha). */
export function lerRegistrosDoDbf<Campo extends string>(dbf: Buffer, campos: readonly Campo[]): Record<Campo, string>[] {
  const quantos = dbf.readUInt32LE(4);
  const tamanhoDoCabecalho = dbf.readUInt16LE(8);
  const tamanhoDoRegistro = dbf.readUInt16LE(10);
  const posicaoDoCampo = new Map<string, { inicio: number; tamanho: number }>();
  let deslocamento = 1;
  for (let descritor = 32; dbf[descritor] !== 0x0d; descritor += 32) {
    const nome = dbf.toString("latin1", descritor, descritor + 11).replace(/\0.*$/, "");
    const tamanho = dbf[descritor + 16] ?? 0;
    posicaoDoCampo.set(nome, { inicio: deslocamento, tamanho });
    deslocamento += tamanho;
  }
  const faltando = campos.filter((campo) => !posicaoDoCampo.has(campo));
  if (faltando.length > 0) throw new Error(`O .dbf não tem os campos ${faltando.join(", ")}.`);
  return Array.from({ length: quantos }, (_, i) => {
    const registro = tamanhoDoCabecalho + i * tamanhoDoRegistro;
    return Object.fromEntries(
      campos.map((campo) => {
        const { inicio, tamanho } = posicaoDoCampo.get(campo) ?? { inicio: 0, tamanho: 0 };
        return [campo, dbf.toString("utf8", registro + inicio, registro + inicio + tamanho).trim()];
      }),
    ) as Record<Campo, string>;
  });
}
