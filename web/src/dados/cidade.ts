import { DETALHE_DA_CIDADE, projetarNaCidade, type Caixa, type MapaDaCidade, type MunicipioDoMapa, type Ponto } from "dominio/mapa";
import { gravidadeDoCliente, type AcoesDoCliente, type Gravidade } from "./mapa";
import type { ClienteResumo } from "./tipos";

/*
 * A cidade de perto: cada empresa no ponto do seu endereço (o CNEFE do IBGE, que o extrator busca),
 * na cor da ação mais grave dela, e a parte do mapa que a cidade ocupa.
 */

/** "em_dia": nada pede ação no cliente. */
export type TomDoCliente = Gravidade | "em_dia";

export type ClienteNoMapa = {
  cliente: ClienteResumo;
  /** Na unidade do desenho da cidade (dominio/mapa.ts, projetarNaCidade). */
  ponto: Ponto;
  tom: TomDoCliente;
};

/**
 * Os clientes da cidade com ponto, do maior faturado ao menor (o desenho põe os menores por cima), e
 * os sem ponto: a pessoa física, que não tem endereço no CRM, e o endereço que o IBGE não achou.
 */
export function clientesNaCidade(
  clientes: readonly ClienteResumo[],
  acoes: ReadonlyMap<string, AcoesDoCliente>,
): { comPonto: ClienteNoMapa[]; semPonto: ClienteResumo[] } {
  const comPonto: ClienteNoMapa[] = [];
  const semPonto: ClienteResumo[] = [];
  for (const cliente of clientes) {
    const ponto = cliente.endereco?.ponto;
    if (!ponto) {
      semPonto.push(cliente);
      continue;
    }
    comPonto.push({ cliente, ponto: projetarNaCidade(ponto.longitude, ponto.latitude), tom: gravidadeDoCliente(acoes.get(cliente.codigo)) ?? "em_dia" });
  }
  return { comPonto: comPonto.sort((a, b) => b.cliente.faturamento12m - a.cliente.faturamento12m), semPonto };
}

/**
 * A parte do mapa que a cidade ocupa, na unidade do estado. Sem o desenho próprio da cidade, a caixa
 * sai do caminho dela no mapa do estado.
 */
export function caixaDaCidade(cidade: MapaDaCidade | null, municipio: MunicipioDoMapa): Caixa {
  if (!cidade) return caixaDoCaminho(municipio.d);
  const [x0, y0, x1, y1] = cidade.caixa;
  return [x0 / DETALHE_DA_CIDADE, y0 / DETALHE_DA_CIDADE, x1 / DETALHE_DA_CIDADE, y1 / DETALHE_DA_CIDADE];
}

/** A caixa de um caminho dos arquivos do mapa: "M x y" absoluto e "l dx dy ..." relativo, anel a anel (extrator/src/mapas/geometria.ts). */
export function caixaDoCaminho(d: string): Caixa {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const anel of d.split("M").filter((trecho) => trecho.trim() !== "")) {
    const [absoluto = "", relativo = ""] = anel.replace(/z/g, "").split("l");
    const [inicioX = 0, inicioY = 0] = absoluto.trim().split(/\s+/).map(Number);
    const passos = relativo.trim() === "" ? [] : relativo.trim().split(/\s+/).map(Number);
    let [x, y] = [inicioX, inicioY];
    for (let i = -2; i < passos.length; i += 2) {
      if (i >= 0) {
        x += passos[i] ?? 0;
        y += passos[i + 1] ?? 0;
      }
      [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
    }
  }
  return [x0, y0, x1, y1];
}
