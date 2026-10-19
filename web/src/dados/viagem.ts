import { distanciaEmKm, projetar, type MapaDaUf, type MunicipioDoMapa, type Ponto } from "dominio/mapa";
import { formatarCep } from "../formato";
import type { ClienteResumo, EnderecoDoCliente } from "./tipos";

/*
 * A viagem do representante: as cidades perto de onde ele está e o roteiro, com a ordem que dá menos
 * estrada em linha reta e o link para o Google Maps. A parada é um cliente, no endereço dele, ou uma
 * cidade. A posição do aparelho fica só na memória da tela; o roteiro fica só neste aparelho
 * (localStorage), com os códigos do município (dado público) e o id opaco do cliente, sem nome.
 */

/** O Google Maps abre até 9 paradas no meio do caminho, mais o destino. */
export const PARADAS_NO_ROTEIRO = 10;
const CHAVE_DO_ROTEIRO = "crm:roteiro";

/** A cidade, ou o cliente nela; o cliente sem ponto no mapa fica no meio da cidade. */
export type Parada = { municipio: MunicipioDoMapa; uf: string; cliente?: ClienteResumo };

/** Onde a parada fica no mapa: o endereço do cliente ou o meio da cidade. */
export function pontoDaParada({ municipio, cliente }: { municipio: MunicipioDoMapa; cliente?: ClienteResumo }): Ponto {
  const ponto = cliente?.endereco?.ponto;
  return ponto ? projetar(ponto.longitude, ponto.latitude) : municipio.centro;
}

/** O que identifica a parada no roteiro gravado: o id do cliente ou o código da cidade. */
export function codigoDaParada({ municipio, cliente }: { municipio: MunicipioDoMapa; cliente?: ClienteResumo }): string {
  return cliente?.codigo ?? municipio.codigo;
}

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
export function ordenarParadas<T extends Parada>(paradas: readonly T[], partida: Ponto | null): T[] {
  const restantes = [...paradas];
  const ordem: T[] = [];
  let atual = partida ?? (restantes[0] ? pontoDaParada(restantes[0]) : undefined);
  while (atual && restantes.length > 0) {
    const de = atual;
    const distancias = restantes.map((parada) => distanciaEmKm(de, pontoDaParada(parada)));
    const [proxima] = restantes.splice(distancias.indexOf(Math.min(...distancias)), 1);
    if (!proxima) break;
    ordem.push(proxima);
    atual = pontoDaParada(proxima);
  }
  return ordem;
}

/** Os km em linha reta até cada parada: da partida (ou 0 na primeira, sem partida) e de uma parada à outra. */
export function trechosDoRoteiro(paradas: readonly Parada[], partida: Ponto | null): number[] {
  return paradas.map((parada, i) => {
    const anterior = i === 0 ? partida : paradas[i - 1] ? pontoDaParada(paradas[i - 1] as Parada) : null;
    return anterior ? distanciaEmKm(anterior, pontoDaParada(parada)) : 0;
  });
}

/**
 * O link do Google Maps com as paradas na ordem: o endereço do cliente, público no CNPJ, ou o nome da
 * cidade. Sem a origem, ele parte de onde o aparelho está, e a posição não sai daqui.
 */
export function linkDoGoogleMaps(paradas: readonly Parada[]): string | null {
  const lugares = paradas
    .slice(0, PARADAS_NO_ROTEIRO)
    .map(({ municipio, uf, cliente }) => (cliente?.endereco ? lugarDoEndereco(cliente.endereco, municipio.nome, uf) : `${municipio.nome}, ${uf}, Brasil`));
  const destino = lugares.at(-1);
  if (!destino) return null;
  const parametros = new URLSearchParams({ api: "1", destination: destino, travelmode: "driving" });
  if (lugares.length > 1) parametros.set("waypoints", lugares.slice(0, -1).join("|"));
  return `https://www.google.com/maps/dir/?${parametros.toString()}`;
}

/**
 * O endereço da empresa no Google Maps, para ver a rua e chegar lá. Vai ao Google só o endereço, que é
 * público no CNPJ, e só quando o representante clica.
 */
export function linkDoEnderecoNoGoogleMaps(endereco: Pick<EnderecoDoCliente, "texto" | "cep">, cidade: string, uf: string): string {
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: lugarDoEndereco(endereco, cidade, uf) }).toString()}`;
}

function lugarDoEndereco({ texto, cep }: Pick<EnderecoDoCliente, "texto" | "cep">, cidade: string, uf: string): string {
  return [texto, `${cidade} - ${uf}`, cep === null ? null : formatarCep(cep), "Brasil"].filter((parte) => parte !== null).join(", ");
}

/**
 * As paradas do roteiro gravado neste aparelho: o código IBGE da cidade (7 dígitos) ou o id do cliente
 * (hexadecimal; na carteira fictícia, só dígitos, mais longo que o da cidade). O resto fica de fora.
 */
export function lerRoteiro(): string[] {
  try {
    const gravado: unknown = JSON.parse(localStorage.getItem(CHAVE_DO_ROTEIRO) ?? "[]");
    return Array.isArray(gravado) ? gravado.filter((codigo): codigo is string => typeof codigo === "string" && /^(\d{7}|[0-9a-f]{12,16})$/.test(codigo)).slice(0, PARADAS_NO_ROTEIRO) : [];
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
