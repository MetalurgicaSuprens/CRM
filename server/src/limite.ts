/*
 * Limite de requisições por janela de tempo (docs/plano.md, "Outras regras"): por IP no login e nos
 * convites, por usuário no resto. A contagem fica na memória, em janela fixa.
 */

export type Limite = { maximo: number; janelaMs: number };

export type Limitador = {
  /** Conta a requisição de quem tem a chave (IP ou usuário) e diz se ela ainda cabe na janela. */
  permitir(chave: string): boolean;
};

/** Teto de quem é contado ao mesmo tempo: acima dele, saem as janelas vencidas. */
const MAXIMO_DE_CHAVES = 10_000;

export function criarLimitador({ maximo, janelaMs }: Limite, agora: () => number = Date.now): Limitador {
  const janelas = new Map<string, { inicio: number; quantas: number }>();
  return {
    permitir(chave) {
      const momento = agora();
      const janela = janelas.get(chave);
      if (janela && momento - janela.inicio < janelaMs) {
        janela.quantas += 1;
        return janela.quantas <= maximo;
      }
      if (janelas.size >= MAXIMO_DE_CHAVES) apagarVencidas(janelas, momento - janelaMs);
      janelas.set(chave, { inicio: momento, quantas: 1 });
      return true;
    },
  };
}

function apagarVencidas(janelas: Map<string, { inicio: number }>, inicioMinimo: number): void {
  for (const [chave, { inicio }] of janelas) if (inicio < inicioMinimo) janelas.delete(chave);
}
