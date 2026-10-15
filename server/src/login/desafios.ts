/*
 * Os desafios da chave de acesso: o valor aleatório que o aparelho assina, para uma resposta velha
 * não servir de novo. Cada um vale 5 minutos, uma vez só, e para uma finalidade: entrar ou criar a
 * chave de um convite. Ficam na memória; se o servidor reiniciar no meio, o representante tenta de novo.
 */

const VALIDADE_MS = 5 * 60_000;
/** Teto contra quem pede opções sem parar: acima dele, sai o mais velho. */
const MAXIMO_GUARDADO = 1_000;

export type Desafios = {
  guardar(desafio: string, finalidade: string): void;
  /** Vale se foi guardado para a mesma finalidade e não venceu; depois de usado, não vale mais. */
  usar(desafio: string, finalidade: string): boolean;
};

export function criarDesafios(agora: () => number = Date.now): Desafios {
  const guardados = new Map<string, { finalidade: string; venceEm: number }>();
  return {
    guardar(desafio, finalidade) {
      if (guardados.size >= MAXIMO_GUARDADO) guardados.delete(guardados.keys().next().value as string);
      guardados.set(desafio, { finalidade, venceEm: agora() + VALIDADE_MS });
    },
    usar(desafio, finalidade) {
      const guardado = guardados.get(desafio);
      guardados.delete(desafio);
      return guardado !== undefined && guardado.finalidade === finalidade && agora() < guardado.venceEm;
    },
  };
}
