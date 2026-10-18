import type { Caixa, Ponto } from "dominio/mapa";

/*
 * A geometria dos arquivos do mapa: o caminho SVG e o contorno da união de municípios. A projeção está
 * em dominio/mapa.ts, porque a tela também usa ("Perto de mim" e o roteiro).
 */

/** Anel aberto: o último ponto não repete o primeiro. */
export type Anel = readonly Ponto[];

/**
 * Sem o ponto repetido em seguida, que o arredondamento cria, e sem o fechamento. O vizinho, com os
 * mesmos vértices, arredonda igual: a divisa continua a mesma dos dois lados. Com menos de 3 pontos, null.
 */
export function limparAnel(pontos: readonly Ponto[]): Anel | null {
  const limpo: Ponto[] = [];
  for (const ponto of pontos) {
    const anterior = limpo.at(-1);
    if (!anterior || !isMesmoPonto(anterior, ponto)) limpo.push(ponto);
  }
  const primeiro = limpo[0];
  const ultimo = limpo.at(-1);
  if (primeiro && ultimo && limpo.length > 1 && isMesmoPonto(primeiro, ultimo)) limpo.pop();
  return limpo.length >= 3 ? limpo : null;
}

/** O caminho SVG: o primeiro ponto de cada anel absoluto e os outros relativos, que são números curtos. */
export function caminhoDosAneis(aneis: readonly Anel[]): string {
  return aneis
    .map((anel) => {
      const passos = anel.slice(1).map((ponto, i) => {
        const anterior = anel[i] as Ponto;
        return `${ponto[0] - anterior[0]} ${ponto[1] - anterior[1]}`;
      });
      const [x, y] = anel[0] as Ponto;
      return `M${x} ${y}l${passos.join(" ")}z`;
    })
    .join("");
}

/**
 * O contorno da união de polígonos vizinhos, como a região imediata ou o estado. A aresta que dois
 * deles dividem se cancela, e as que sobram se emendam em anéis. Supõe a malha topológica do IBGE, em
 * que os vizinhos dividem os mesmos vértices (conferido em 2026-10-15: nenhuma aresta em mais de dois).
 */
export function contornoDaUniao(aneis: readonly Anel[]): Anel[] {
  const arestas = aneis.flatMap(arestasDoAnel);
  const vezes = new Map<string, number>();
  for (const [de, para] of arestas) vezes.set(chaveDaAresta(de, para), (vezes.get(chaveDaAresta(de, para)) ?? 0) + 1);
  const doContorno = arestas.filter(([de, para]) => vezes.get(chaveDaAresta(de, para)) === 1);
  const saidas = new Map<string, Ponto[]>();
  for (const [de, para] of doContorno) {
    const destinos = saidas.get(chaveDoPonto(de));
    if (destinos) destinos.push(para);
    else saidas.set(chaveDoPonto(de), [para]);
  }
  return doContorno.flatMap(([inicio]) => {
    const anel = percorrer(saidas, inicio);
    return anel ? [anel] : [];
  });
}

/** Os grupos que dividem alguma aresta do contorno, como duas regiões que fazem divisa, por código. */
export function vizinhosPorDivisa(contornos: ReadonlyMap<string, readonly Anel[]>): Map<string, string[]> {
  const gruposDaAresta = new Map<string, Set<string>>();
  for (const [codigo, aneis] of contornos) {
    for (const [de, para] of aneis.flatMap(arestasDoAnel)) {
      const grupos = gruposDaAresta.get(chaveDaAresta(de, para)) ?? new Set<string>();
      grupos.add(codigo);
      gruposDaAresta.set(chaveDaAresta(de, para), grupos);
    }
  }
  const vizinhos = new Map<string, Set<string>>([...contornos.keys()].map((codigo) => [codigo, new Set<string>()]));
  for (const grupos of gruposDaAresta.values()) {
    for (const codigo of grupos) for (const outro of grupos) if (outro !== codigo) vizinhos.get(codigo)?.add(outro);
  }
  return new Map([...vizinhos].map(([codigo, conjunto]) => [codigo, [...conjunto].sort()]));
}

/** Onde fica o círculo: o centro de área do maior anel, que é o pedaço principal do município. */
export function centroDoMaiorAnel(aneis: readonly Anel[]): Ponto {
  const [primeiro, ...demais] = aneis;
  if (!primeiro) throw new Error("Município sem anel.");
  const maior = demais.reduce((escolhido, anel) => (Math.abs(areaDobrada(anel)) > Math.abs(areaDobrada(escolhido)) ? anel : escolhido), primeiro);
  const area2 = areaDobrada(maior);
  let x = 0;
  let y = 0;
  for (const [a, b] of arestasDoAnel(maior)) {
    const cruzado = a[0] * b[1] - b[0] * a[1];
    x += (a[0] + b[0]) * cruzado;
    y += (a[1] + b[1]) * cruzado;
  }
  return [Math.round(x / (3 * area2)), Math.round(y / (3 * area2))];
}

export function caixaDosAneis(aneis: readonly Anel[]): Caixa {
  const pontos = aneis.flat();
  const xs = pontos.map(([x]) => x);
  const ys = pontos.map(([, y]) => y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** Segue as arestas a partir do início, gastando cada uma, até voltar a ele; null quando já foram gastas. */
function percorrer(saidas: Map<string, Ponto[]>, inicio: Ponto): Anel | null {
  const anel: Ponto[] = [];
  let atual = inicio;
  for (;;) {
    const proximo = saidas.get(chaveDoPonto(atual))?.pop();
    if (!proximo) break;
    anel.push(atual);
    if (isMesmoPonto(proximo, inicio)) break;
    atual = proximo;
  }
  return anel.length >= 3 ? anel : null;
}

function arestasDoAnel(anel: Anel): [Ponto, Ponto][] {
  return anel.map((ponto, i) => [ponto, anel[(i + 1) % anel.length] as Ponto]);
}

/** Duas vezes a área com sinal (fórmula do laço). */
function areaDobrada(anel: Anel): number {
  return arestasDoAnel(anel).reduce((soma, [a, b]) => soma + a[0] * b[1] - b[0] * a[1], 0);
}

function chaveDoPonto([x, y]: Ponto): string {
  return `${x},${y}`;
}

/** A mesma aresta nos dois sentidos: o vizinho percorre a divisa ao contrário. */
function chaveDaAresta(de: Ponto, para: Ponto): string {
  const a = chaveDoPonto(de);
  const b = chaveDoPonto(para);
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function isMesmoPonto(a: Ponto, b: Ponto): boolean {
  return a[0] === b[0] && a[1] === b[1];
}
