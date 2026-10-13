/*
 * Conceitos do negócio que as regras, o extrator, o servidor e as telas compartilham.
 */

/** "inativo": 24 meses ou mais sem comprar. */
export type Situacao = "ativo" | "em_risco" | "parado" | "novo" | "inativo";

export type Mercado = "PRACA" | "MONTADORA" | "EXPORTACAO";

/** Tercil do faturado em 12 meses dentro do mercado. */
export type Porte = "pequeno" | "medio" | "grande";

export type OportunidadeMix = {
  familia: string;
  /** Parcela dos clientes parecidos (mesmo mercado e faixa de porte) que compram a família. */
  penetracao: number;
};
