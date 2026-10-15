import type { MapaDaUf, MapaDoBrasil, MunicipioDoMapa, RegiaoDoMapa } from "dominio/mapa";
import { caixaDosAneis, caminhoDosAneis, centroDoMaiorAnel, contornoDaUniao, vizinhosPorDivisa, type Anel } from "./geometria.ts";
import { chaveDaPopulacao, type FeicaoDaMalha, type MunicipioIbge } from "./ibge.ts";

/*
 * O arquivo de cada estado: os municípios, as regiões imediatas e o contorno, com a população do
 * Censo 2022. As regiões e o estado são a união dos municípios, sem as divisas de dentro.
 */

export type MapaMontado = {
  mapa: MapaDaUf;
  /** Municípios sem população na base do Censo: o nome não bateu. */
  semPopulacao: string[];
};

export function montarMapaDaUf(
  feicoes: readonly FeicaoDaMalha[],
  municipios: ReadonlyMap<string, MunicipioIbge>,
  populacao: Readonly<Record<string, number>>,
): MapaMontado {
  const daUf = feicoes.map((feicao) => ({ ...feicao, municipio: municipioDa(feicao, municipios) }));
  const [primeiro] = daUf;
  if (!primeiro) throw new Error("Malha de estado sem município.");
  const semPopulacao = daUf.filter(({ municipio }) => populacao[chaveDaPopulacao(municipio)] === undefined).map(({ municipio }) => municipio.nome);
  const todosOsAneis = daUf.flatMap(({ aneis }) => aneis);
  return {
    mapa: {
      uf: primeiro.municipio.uf,
      nome: primeiro.municipio.nomeDaUf,
      caixa: caixaDosAneis(todosOsAneis),
      contorno: caminhoDosAneis(contornoDaUniao(todosOsAneis)),
      regioes: regioesDa(daUf),
      municipios: daUf
        .map(({ municipio, aneis }): MunicipioDoMapa => ({
          codigo: municipio.codigo,
          nome: municipio.nome,
          regiao: municipio.regiao.codigo,
          populacao: populacao[chaveDaPopulacao(municipio)] ?? null,
          d: caminhoDosAneis(aneis),
          centro: centroDoMaiorAnel(aneis),
        }))
        .sort((a, b) => a.codigo.localeCompare(b.codigo)),
    },
    semPopulacao,
  };
}

/** O fundo do mapa: só o contorno e a caixa de cada estado. */
export function montarMapaDoBrasil(mapas: readonly MapaDaUf[]): MapaDoBrasil {
  return {
    ufs: mapas.map(({ uf, nome, caixa, contorno }) => ({ uf, nome, caixa, contorno })).sort((a, b) => a.uf.localeCompare(b.uf)),
  };
}

/** As regiões imediatas do estado, cada uma com o contorno e as vizinhas do mesmo estado. */
function regioesDa(daUf: readonly { municipio: MunicipioIbge; aneis: Anel[] }[]): RegiaoDoMapa[] {
  const porRegiao = new Map<string, { nome: string; aneis: Anel[] }>();
  for (const { municipio, aneis } of daUf) {
    const regiao = porRegiao.get(municipio.regiao.codigo) ?? { nome: municipio.regiao.nome, aneis: [] };
    regiao.aneis.push(...aneis);
    porRegiao.set(municipio.regiao.codigo, regiao);
  }
  const contornos = new Map([...porRegiao].map(([codigo, { aneis }]) => [codigo, contornoDaUniao(aneis)]));
  const vizinhas = vizinhosPorDivisa(contornos);
  return [...porRegiao.entries()]
    .map(([codigo, { nome, aneis }]) => ({
      codigo,
      nome,
      contorno: caminhoDosAneis(contornos.get(codigo) ?? []),
      caixa: caixaDosAneis(aneis),
      vizinhas: vizinhas.get(codigo) ?? [],
    }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
}

function municipioDa(feicao: FeicaoDaMalha, municipios: ReadonlyMap<string, MunicipioIbge>): MunicipioIbge {
  const municipio = municipios.get(feicao.codigo);
  if (!municipio) throw new Error(`Município ${feicao.codigo} da malha fora da lista do IBGE.`);
  return municipio;
}
