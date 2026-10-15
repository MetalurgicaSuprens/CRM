import type { MapaDaUf, MapaDoBrasil } from "dominio/mapa";

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

async function buscar<T>(caminho: string): Promise<T> {
  const resposta = await fetch(caminho);
  if (!resposta.ok) throw new Error(`O mapa não carregou (${resposta.status}).`);
  return (await resposta.json()) as T;
}
