import type { MapaDaCidade, MapaDaUf, MapaDoBrasil } from "dominio/mapa";

/*
 * Os arquivos do mapa, estáticos e do próprio servidor (web/public/mapas, gerados pelo extrator a
 * partir das bases do IBGE). São os mesmos com os dados fictícios e com os reais.
 */

export function carregarMapaDoBrasil(): Promise<MapaDoBrasil> {
  return buscar("/mapas/brasil.json");
}

export function carregarMapaDaUf(uf: string): Promise<MapaDaUf> {
  // A sigla vem do cadastro do cliente: só duas letras viram nome de arquivo.
  if (!/^[A-Z]{2}$/.test(uf)) return Promise.reject(new Error(`Estado sem mapa: ${uf}`));
  return buscar(`/mapas/${uf}.json`);
}

/**
 * O desenho da cidade, para o mapa aproximar dela. Só as cidades com cliente quando o arquivo foi
 * gerado têm o seu (extrator/src/mapas/gerarCidades.ts): sem ele, null, e o mapa usa o do estado.
 */
export async function carregarMapaDaCidade(codigo: string): Promise<MapaDaCidade | null> {
  // O código vem da escolha na tela: só os 7 dígitos do IBGE viram nome de arquivo.
  if (!/^\d{7}$/.test(codigo)) return null;
  const resposta = await fetch(`/mapas/cidades/${codigo}.json`);
  if (resposta.status === 404) return null;
  if (!resposta.ok) throw new Error(`O mapa da cidade não carregou (${resposta.status}).`);
  return (await resposta.json()) as MapaDaCidade;
}

async function buscar<T>(caminho: string): Promise<T> {
  const resposta = await fetch(caminho);
  if (!resposta.ok) throw new Error(`O mapa não carregou (${resposta.status}).`);
  return (await resposta.json()) as T;
}
