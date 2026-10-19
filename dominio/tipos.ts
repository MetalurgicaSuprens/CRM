/*
 * Conceitos do negócio que as regras, o extrator, o servidor e as telas compartilham.
 */

/** A situação de compra, que o CRM calcula pelas notas. "perdido": mais de 24 meses sem comprar. */
export type Situacao = "ativo" | "em_risco" | "parado" | "novo" | "perdido";

/** O status do cliente no cadastro do SGI (`CLI3_STA`), com os nomes de lá. */
export type StatusDoCadastro = "ativo" | "inativo" | "substituido";

export type Mercado = "PRACA" | "MONTADORA" | "EXPORTACAO";

/**
 * Quão perto do endereço fica o ponto do cliente no mapa (extrator/src/localizacao): no próprio número,
 * na rua (o número mais perto que o IBGE tem nela) ou no meio da área do CEP.
 */
export type PrecisaoDoPonto = "numero" | "rua" | "cep";

/** Tercil do faturado em 12 meses dentro do mercado. */
export type Porte = "pequeno" | "medio" | "grande";

export type OportunidadeMix = {
  familia: string;
  /** Parcela dos clientes parecidos (mesmo mercado e faixa de porte) que compram a família. */
  penetracao: number;
};
