/*
 * Os arquivos do mapa (web/public/mapas), que o extrator gera uma vez a partir das bases públicas do
 * IBGE (extrator/src/mapas). As coordenadas são décimos de km na projeção de Mercator, iguais para o
 * Brasil inteiro: o mapa de um estado mostra os vizinhos no lugar certo.
 */

/** [x mínimo, y mínimo, x máximo, y máximo]; o y cresce para o sul, como no SVG. */
export type Caixa = readonly [number, number, number, number];

export type MunicipioDoMapa = {
  /** Código IBGE de 7 dígitos, o mesmo do cadastro do cliente no ERP (CRCL.RESERVADO7). */
  codigo: string;
  nome: string;
  /** Código da região imediata do IBGE: a cidade-polo e o entorno dela. */
  regiao: string;
  /** Censo 2022; null quando o município não está na base de população. */
  populacao: number | null;
  /** Caminho SVG do município. */
  d: string;
  /** Onde fica o círculo do município: o centro do maior pedaço dele. */
  centro: readonly [number, number];
};

export type RegiaoDoMapa = {
  codigo: string;
  nome: string;
  contorno: string;
  caixa: Caixa;
  /** As regiões do mesmo estado que fazem divisa com esta. */
  vizinhas: string[];
};

export type MapaDaUf = {
  uf: string;
  nome: string;
  caixa: Caixa;
  contorno: string;
  regioes: RegiaoDoMapa[];
  municipios: MunicipioDoMapa[];
};

/** O fundo do mapa: o contorno de cada estado, para os vizinhos aparecerem em volta. */
export type MapaDoBrasil = {
  ufs: { uf: string; nome: string; caixa: Caixa; contorno: string }[];
};
