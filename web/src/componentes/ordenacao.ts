import { normalizarParaBusca } from "../formato";

export type Sentido = "crescente" | "decrescente";

/** O que decide a posição da linha. Vazio (null) fica sempre no fim, nos dois sentidos. */
export type Comparavel = number | string | null;

export type ColunaOrdenavel<T> = {
  titulo: string;
  /** Coluna de números: alinhada à direita e, ao ordenar, começa do maior para o menor; o resto, de A a Z. */
  numerica?: boolean;
  /** Sem ele, o título não ordena (ações, campos de quantidade, gráficos). */
  ordenarPor?: (item: T) => Comparavel;
};

/** A coluna é identificada pelo título. */
export type Ordem = { coluna: string; sentido: Sentido };

/** Códigos com número ("CRM-00108", "NF 182345") comparam pelo valor do número, e acento não pesa. */
const COLACAO = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

/** Ordena uma cópia; empates mantêm a ordem em que os dados chegaram. */
export function ordenar<T>(itens: readonly T[], valorDe: (item: T) => Comparavel, sentido: Sentido): T[] {
  const fator = sentido === "crescente" ? 1 : -1;
  return [...itens].sort((a, b) => {
    const x = valorDe(a);
    const y = valorDe(b);
    if (x === null || y === null) return Number(x === null) - Number(y === null);
    return fator * comparar(x, y);
  });
}

function comparar(x: string | number, y: string | number): number {
  return typeof x === "number" && typeof y === "number" ? x - y : COLACAO.compare(String(x), String(y));
}

/** Clicar no título da coluna já escolhida inverte o sentido; numa outra, começa pelo sentido natural dela. */
export function proximaOrdem<T>(atual: Ordem | null, coluna: ColunaOrdenavel<T>): Ordem {
  if (atual?.coluna === coluna.titulo) {
    return { coluna: coluna.titulo, sentido: atual.sentido === "crescente" ? "decrescente" : "crescente" };
  }
  return { coluna: coluna.titulo, sentido: coluna.numerica ? "decrescente" : "crescente" };
}

/** Na URL: "faturado-12-meses" é crescente; "-faturado-12-meses", decrescente. */
export function escreverOrdem(ordem: Ordem): string {
  const chave = chaveDaColuna(ordem.coluna);
  return ordem.sentido === "crescente" ? chave : `-${chave}`;
}

/** Ordem que não corresponde a uma coluna ordenável da tabela (endereço antigo ou editado) é ignorada. */
export function lerOrdem<T>(texto: string | null, colunas: readonly ColunaOrdenavel<T>[]): Ordem | null {
  if (!texto) return null;
  const decrescente = texto.startsWith("-");
  const chave = decrescente ? texto.slice(1) : texto;
  const coluna = colunas.find((candidata) => candidata.ordenarPor && chaveDaColuna(candidata.titulo) === chave);
  return coluna ? { coluna: coluna.titulo, sentido: decrescente ? "decrescente" : "crescente" } : null;
}

function chaveDaColuna(titulo: string): string {
  return normalizarParaBusca(titulo)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
