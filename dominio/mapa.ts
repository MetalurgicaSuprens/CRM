/*
 * Os arquivos do mapa (web/public/mapas), que o extrator gera uma vez a partir das bases públicas do
 * IBGE (extrator/src/mapas). As coordenadas são décimos de km na projeção de Mercator, iguais para o
 * Brasil inteiro: o mapa de um estado mostra os vizinhos no lugar certo. A mesma projeção põe no mapa
 * a posição do aparelho ("Perto de mim") e mede as distâncias do roteiro.
 */

/** [x, y] no mapa; o y cresce para o sul, como no SVG. */
export type Ponto = readonly [number, number];

/** [x mínimo, y mínimo, x máximo, y máximo]; o y cresce para o sul, como no SVG. */
export type Caixa = readonly [number, number, number, number];

const RAIO_DA_TERRA_KM = 6371;
/** Décimos de km: a malha mínima do IBGE vem com 4 casas (uns 11 m), e o mapa não precisa de mais. */
const UNIDADES_POR_KM = 10;
const ESCALA = RAIO_DA_TERRA_KM * UNIDADES_POR_KM;

/** Mercator, que preserva a forma, como os mapas do dia a dia; o y cresce para o sul, como no SVG. */
export function projetar(longitude: number, latitude: number): Ponto {
  const lambda = (longitude * Math.PI) / 180;
  const phi = (latitude * Math.PI) / 180;
  return [Math.round(ESCALA * lambda), Math.round(-ESCALA * Math.log(Math.tan(Math.PI / 4 + phi / 2)))];
}

/** A latitude, em graus, de um y do mapa: o caminho de volta da Mercator. */
export function latitudeDoY(y: number): number {
  return ((2 * Math.atan(Math.exp(-y / ESCALA)) - Math.PI / 2) * 180) / Math.PI;
}

/**
 * A distância em linha reta, em km, entre dois pontos do mapa. A Mercator estica as distâncias por
 * 1/cos(latitude); a conta desfaz isso na latitude do meio, o que basta para cidades a centenas de km.
 */
export function distanciaEmKm([x0, y0]: Ponto, [x1, y1]: Ponto): number {
  const latitude = (latitudeDoY((y0 + y1) / 2) * Math.PI) / 180;
  return (Math.hypot(x1 - x0, y1 - y0) / UNIDADES_POR_KM) * Math.cos(latitude);
}

/** Quantas unidades do mapa cobrem `km` em volta de um ponto na altura `y`: para aproximar o mapa dele. */
export function unidadesDoMapa(km: number, y: number): number {
  return (km * UNIDADES_POR_KM) / Math.cos((latitudeDoY(y) * Math.PI) / 180);
}

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
  centro: Ponto;
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
