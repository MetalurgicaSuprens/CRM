export type Aleatorio = {
  proximo: () => number;
  entre: (minimo: number, maximo: number) => number;
  inteiro: (minimo: number, maximo: number) => number;
  chance: (probabilidade: number) => boolean;
  escolher: <T>(itens: readonly T[]) => T;
};

/** Sorteio determinístico (mulberry32): a mesma semente gera sempre a mesma carteira fictícia. */
export function criarAleatorio(semente: number): Aleatorio {
  let estado = semente >>> 0;
  const proximo = () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  const entre = (minimo: number, maximo: number) => minimo + proximo() * (maximo - minimo);
  const inteiro = (minimo: number, maximo: number) => Math.floor(entre(minimo, maximo + 1));
  return {
    proximo,
    entre,
    inteiro,
    chance: (probabilidade) => proximo() < probabilidade,
    escolher: <T>(itens: readonly T[]) => {
      const item = itens[Math.floor(proximo() * itens.length)];
      if (item === undefined) throw new Error("Lista vazia no sorteio");
      return item;
    },
  };
}
