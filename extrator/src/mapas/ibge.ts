import { projetar, type Ponto } from "dominio/mapa";
import { limparAnel, type Anel } from "./geometria.ts";

/*
 * As bases públicas do IBGE, baixadas uma vez: a lista dos municípios (api/v1/localidades/municipios)
 * e a malha de cada estado na qualidade mínima (api/v3/malhas/estados). São dados de fora: o formato
 * é conferido aqui, e o que não bate para o gerador.
 */

export type MunicipioIbge = {
  codigo: string;
  nome: string;
  uf: string;
  nomeDaUf: string;
  regiao: { codigo: string; nome: string };
};

/** Um município (ou um distrito, na malha de dentro do município) da malha, já projetado. */
export type FeicaoDaMalha = { codigo: string; aneis: Anel[] };

export type Projecao = (longitude: number, latitude: number) => Ponto;

export function lerMunicipios(json: unknown): Map<string, MunicipioIbge> {
  if (!Array.isArray(json)) throw new Error("A lista de municípios do IBGE não é uma lista.");
  return new Map(
    json.map((item: unknown) => {
      const municipio = item as {
        id: number;
        nome: string;
        "regiao-imediata": { id: number; nome: string; "regiao-intermediaria": { UF: { sigla: string; nome: string } } };
      };
      const regiao = municipio["regiao-imediata"];
      const uf = regiao?.["regiao-intermediaria"]?.UF;
      if (typeof municipio.id !== "number" || typeof municipio.nome !== "string" || !regiao || !uf) {
        throw new Error(`Município do IBGE fora do formato: ${JSON.stringify(item).slice(0, 120)}`);
      }
      const codigo = String(municipio.id);
      return [codigo, { codigo, nome: municipio.nome, uf: uf.sigla, nomeDaUf: uf.nome, regiao: { codigo: String(regiao.id), nome: regiao.nome } }];
    }),
  );
}

/** A malha do município tem código de 7 dígitos; a dos distritos, de 9. */
export function lerMalha(json: unknown, projecao: Projecao = projetar): FeicaoDaMalha[] {
  const colecao = json as { type?: string; features?: unknown[] };
  if (colecao.type !== "FeatureCollection" || !Array.isArray(colecao.features)) throw new Error("A malha do IBGE não é uma FeatureCollection.");
  return colecao.features.map((item) => {
    const feicao = item as { properties?: { codarea?: string }; geometry?: { type: string; coordinates: unknown } };
    const codigo = feicao.properties?.codarea;
    if (typeof codigo !== "string" || !/^(\d{7}|\d{9})$/.test(codigo) || !feicao.geometry) {
      throw new Error(`Feição da malha fora do formato: ${JSON.stringify(item).slice(0, 120)}`);
    }
    return { codigo, aneis: aneisDaGeometria(feicao.geometry, projecao) };
  });
}

/** O nome como a base de população do protótipo guarda: sem acento, em minúsculas e sem pontuação. */
export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** A chave da base de população do Censo 2022 (CRM-prototipo/data/geo/ibge-populacao.json): "go|goiania". */
export function chaveDaPopulacao(municipio: Pick<MunicipioIbge, "uf" | "nome">): string {
  return `${municipio.uf.toLowerCase()}|${normalizarNome(municipio.nome)}`;
}

/** Os anéis externos e os buracos, projetados; o GeoJSON fecha cada anel repetindo o primeiro ponto. */
function aneisDaGeometria(geometria: { type: string; coordinates: unknown }, projecao: Projecao): Anel[] {
  const poligonos =
    geometria.type === "Polygon"
      ? [geometria.coordinates as number[][][]]
      : geometria.type === "MultiPolygon"
        ? (geometria.coordinates as number[][][][])
        : null;
  if (!poligonos) throw new Error(`Geometria sem polígono: ${geometria.type}`);
  return projetarAneis(poligonos.flat(), projecao);
}

/** Os anéis em [longitude, latitude], projetados e limpos (geometria.ts, limparAnel). */
export function projetarAneis(aneis: readonly (readonly (readonly number[])[])[], projecao: Projecao): Anel[] {
  return aneis.flatMap((anel) => {
    const projetado = limparAnel(anel.map(([longitude, latitude]) => projecao(Number(longitude), Number(latitude))));
    return projetado ? [projetado] : [];
  });
}
