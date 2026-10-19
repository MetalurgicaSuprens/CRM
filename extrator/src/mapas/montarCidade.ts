import type { MapaDaCidade } from "dominio/mapa";
import { caixaDosAneis, caminhoDosAneis, centroDoMaiorAnel, type Anel } from "./geometria.ts";

/*
 * O desenho de uma cidade para o mapa aproximar dela: o contorno e as divisões de dentro. Os bairros
 * do Censo 2022 vêm primeiro; sem eles, os distritos. Uma área só é a cidade inteira, que o contorno
 * já desenha: aí a cidade fica sem divisões.
 */

export type AreaParaDesenhar = { nome: string; aneis: Anel[] };

export function montarMapaDaCidade(
  codigo: string,
  contorno: readonly Anel[],
  { bairros, distritos }: { bairros: readonly AreaParaDesenhar[]; distritos: readonly AreaParaDesenhar[] },
): MapaDaCidade {
  const comDesenho = (areas: readonly AreaParaDesenhar[]) => areas.filter(({ aneis }) => aneis.length > 0);
  const divisoes =
    comDesenho(bairros).length >= 2
      ? { tipo: "bairro" as const, areas: comDesenho(bairros) }
      : comDesenho(distritos).length >= 2
        ? { tipo: "distrito" as const, areas: comDesenho(distritos) }
        : null;
  return {
    codigo,
    caixa: caixaDosAneis(contorno),
    contorno: caminhoDosAneis(contorno),
    divisoes: divisoes && {
      tipo: divisoes.tipo,
      areas: [...divisoes.areas]
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        .map(({ nome, aneis }) => ({ nome, d: caminhoDosAneis(aneis), centro: centroDoMaiorAnel(aneis) })),
    },
  };
}
