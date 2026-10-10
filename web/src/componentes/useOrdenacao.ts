import { useSearchParams } from "react-router";
import { escreverOrdem, lerOrdem, ordenar, proximaOrdem, type ColunaOrdenavel, type Ordem, type Sentido } from "./ordenacao";

export type Ordenacao<T> = {
  ordenados: readonly T[];
  sentidoDe: (coluna: ColunaOrdenavel<T>) => Sentido | null;
  alternar: (coluna: ColunaOrdenavel<T>) => void;
};

type Opcoes = {
  /** A ordem ao abrir a tela; sem ela, os itens ficam na ordem em que chegam, sem coluna marcada. */
  inicial?: Ordem;
  /** Nome na URL. Muda só quando há duas tabelas na mesma tela. */
  parametro?: string;
};

/**
 * Ordem escolhida pelo título das colunas. Fica na URL, como os filtros: ao voltar da ficha de um
 * cliente, a lista continua na ordem em que estava.
 */
export function useOrdenacao<T>(itens: readonly T[], colunas: readonly ColunaOrdenavel<T>[], { inicial, parametro = "ordem" }: Opcoes = {}): Ordenacao<T> {
  const [parametros, setParametros] = useSearchParams();
  const ordem = lerOrdem(parametros.get(parametro), colunas) ?? inicial ?? null;
  const valorDe = colunas.find((coluna) => coluna.titulo === ordem?.coluna)?.ordenarPor;
  return {
    ordenados: ordem && valorDe ? ordenar(itens, valorDe, ordem.sentido) : itens,
    sentidoDe: (coluna) => (ordem?.coluna === coluna.titulo ? ordem.sentido : null),
    alternar: (coluna) => {
      const proximos = new URLSearchParams(parametros);
      proximos.set(parametro, escreverOrdem(proximaOrdem(ordem, coluna)));
      setParametros(proximos, { replace: true });
    },
  };
}
