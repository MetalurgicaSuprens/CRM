import type { MunicipioDoMapa } from "dominio/mapa";

/*
 * Onde vai o nome dos maiores municípios no mapa: ao lado do círculo, sem encostar em outro nome nem
 * sair do quadro. As posições estão nas unidades do mapa; a escala converte as medidas em px.
 */

/** A parte do mapa à vista, nas unidades do mapa. */
export type Vista = { x: number; y: number; largura: number; altura: number };

export type NomeNoMapa = { municipio: MunicipioDoMapa; x: number; y: number; isAEsquerda: boolean };

type Contexto = {
  vista: Vista;
  /** Unidades do mapa por px da tela. */
  escala: number;
  /** O raio do círculo do município, em px. */
  raioDe: (municipio: MunicipioDoMapa) => number;
};

type Retangulo = readonly [number, number, number, number];

/** A largura de uma letra do nome em Plex Sans seminegrito de 12 px, com folga, em px. */
const LARGURA_DA_LETRA = 6.8;
const ALTURA_DO_NOME = 14;
const DISTANCIA_DO_CIRCULO = 5;
/** O texto de 12 px fica no meio do círculo com a linha de base 4 px abaixo do centro. */
const DESCIDA_DA_LINHA_DE_BASE = 4;

/**
 * Do município que mais pesa ao que menos: o nome vai à direita do círculo, ou à esquerda quando à
 * direita ele sai do quadro ou encosta num nome já posto. Sem lugar dos dois lados, fica sem nome.
 */
export function posicionarNomes(municipios: readonly MunicipioDoMapa[], contexto: Contexto): NomeNoMapa[] {
  const postos: Retangulo[] = [];
  return municipios.flatMap((municipio) => {
    // O município aproximado para fora do quadro não deixa o nome solto na borda.
    if (!isNaVista(municipio.centro, contexto.vista)) return [];
    const livre = ladosDoNome(municipio, contexto).find(
      ({ caixa }) => cabeNaVista(caixa, contexto.vista) && !postos.some((posto) => seSobrepoem(posto, caixa)),
    );
    if (!livre) return [];
    postos.push(livre.caixa);
    return [{ municipio, x: livre.x, y: municipio.centro[1] + DESCIDA_DA_LINHA_DE_BASE * contexto.escala, isAEsquerda: livre.isAEsquerda }];
  });
}

/** O nome à direita e à esquerda do círculo, nesta ordem de preferência. */
function ladosDoNome(municipio: MunicipioDoMapa, { escala, raioDe }: Contexto): { isAEsquerda: boolean; x: number; caixa: Retangulo }[] {
  const [centroX, centroY] = municipio.centro;
  const largura = municipio.nome.length * LARGURA_DA_LETRA * escala;
  const meiaAltura = (ALTURA_DO_NOME / 2) * escala;
  const afastamento = (raioDe(municipio) + DISTANCIA_DO_CIRCULO) * escala;
  return [false, true].map((isAEsquerda) => {
    const x = isAEsquerda ? centroX - afastamento : centroX + afastamento;
    const inicio = isAEsquerda ? x - largura : x;
    return { isAEsquerda, x, caixa: [inicio, centroY - meiaAltura, inicio + largura, centroY + meiaAltura] };
  });
}

function isNaVista([x, y]: readonly [number, number], vista: Vista): boolean {
  return x >= vista.x && x <= vista.x + vista.largura && y >= vista.y && y <= vista.y + vista.altura;
}

function cabeNaVista([x0, y0, x1, y1]: Retangulo, vista: Vista): boolean {
  return isNaVista([x0, y0], vista) && isNaVista([x1, y1], vista);
}

function seSobrepoem(a: Retangulo, b: Retangulo): boolean {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}
