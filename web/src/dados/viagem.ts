import { distanciaEmKm, type MapaDaUf, type MunicipioDoMapa, type Ponto } from "dominio/mapa";

/*
 * A viagem do representante: as cidades perto de onde ele está e o roteiro, com a ordem que dá menos
 * estrada em linha reta e o link para o Google Maps. A posição do aparelho fica só na memória da tela;
 * o roteiro fica só neste aparelho (localStorage), e são códigos de município, dado público, sem nada
 * da carteira.
 */

/** O Google Maps abre até 9 paradas no meio do caminho, mais o destino. */
export const PARADAS_NO_ROTEIRO = 10;
const CHAVE_DO_ROTEIRO = "crm:roteiro";

export type Parada = { municipio: MunicipioDoMapa; uf: string };

/** O município mais perto do ponto, entre os dos estados carregados, com o estado e a distância. */
export function municipioMaisPerto(ponto: Ponto, mapas: readonly MapaDaUf[]): (Parada & { distanciaKm: number }) | null {
  let maisPerto: (Parada & { distanciaKm: number }) | null = null;
  for (const mapa of mapas) {
    for (const municipio of mapa.municipios) {
      const distanciaKm = distanciaEmKm(ponto, municipio.centro);
      if (!maisPerto || distanciaKm < maisPerto.distanciaKm) maisPerto = { municipio, uf: mapa.uf, distanciaKm };
    }
  }
  return maisPerto;
}

/** Os lugares a até `raioKm` do ponto, do mais perto ao mais longe. */
export function pertoDe<T extends { municipio: MunicipioDoMapa }>(ponto: Ponto, lugares: readonly T[], raioKm: number): (T & { distanciaKm: number })[] {
  return lugares
    .map((lugar) => ({ ...lugar, distanciaKm: distanciaEmKm(ponto, lugar.municipio.centro) }))
    .filter(({ distanciaKm }) => distanciaKm <= raioKm)
    .sort((a, b) => a.distanciaKm - b.distanciaKm);
}

/**
 * A ordem das paradas pelo vizinho mais perto: de onde o representante está (ou da primeira parada
 * escolhida), sempre para a parada mais próxima que falta. Não é a menor rota possível, mas é curta e
 * fácil de entender.
 */
export function ordenarParadas<T extends { municipio: MunicipioDoMapa }>(paradas: readonly T[], partida: Ponto | null): T[] {
  const restantes = [...paradas];
  const ordem: T[] = [];
  let atual = partida ?? restantes[0]?.municipio.centro;
  while (atual && restantes.length > 0) {
    const de = atual;
    const distancias = restantes.map(({ municipio }) => distanciaEmKm(de, municipio.centro));
    const [proxima] = restantes.splice(distancias.indexOf(Math.min(...distancias)), 1);
    if (!proxima) break;
    ordem.push(proxima);
    atual = proxima.municipio.centro;
  }
  return ordem;
}

/** Os km em linha reta até cada parada: da partida (ou 0 na primeira, sem partida) e de uma parada à outra. */
export function trechosDoRoteiro(paradas: readonly { municipio: MunicipioDoMapa }[], partida: Ponto | null): number[] {
  return paradas.map(({ municipio }, i) => {
    const anterior = i === 0 ? partida : (paradas[i - 1]?.municipio.centro ?? null);
    return anterior ? distanciaEmKm(anterior, municipio.centro) : 0;
  });
}

/**
 * O link do Google Maps com as cidades na ordem. Sem a origem, ele parte de onde o aparelho está, e
 * a posição não sai daqui. Só os nomes das cidades vão ao Google.
 */
export function linkDoGoogleMaps(paradas: readonly Parada[]): string | null {
  const lugares = paradas.slice(0, PARADAS_NO_ROTEIRO).map(({ municipio, uf }) => `${municipio.nome}, ${uf}, Brasil`);
  const destino = lugares.at(-1);
  if (!destino) return null;
  const parametros = new URLSearchParams({ api: "1", destination: destino, travelmode: "driving" });
  if (lugares.length > 1) parametros.set("waypoints", lugares.slice(0, -1).join("|"));
  return `https://www.google.com/maps/dir/?${parametros.toString()}`;
}

/** Os códigos IBGE do roteiro gravado neste aparelho; o que não for código de município fica de fora. */
export function lerRoteiro(): string[] {
  try {
    const gravado: unknown = JSON.parse(localStorage.getItem(CHAVE_DO_ROTEIRO) ?? "[]");
    return Array.isArray(gravado) ? gravado.filter((codigo): codigo is string => typeof codigo === "string" && /^\d{7}$/.test(codigo)).slice(0, PARADAS_NO_ROTEIRO) : [];
  } catch {
    // Sem armazenamento (janela anônima, dados bloqueados): o roteiro começa vazio.
    return [];
  }
}

export function gravarRoteiro(codigos: readonly string[]): void {
  try {
    localStorage.setItem(CHAVE_DO_ROTEIRO, JSON.stringify(codigos.slice(0, PARADAS_NO_ROTEIRO)));
  } catch {
    // Sem armazenamento: o roteiro vale só enquanto a tela estiver aberta.
  }
}
