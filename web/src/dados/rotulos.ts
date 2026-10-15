import type { Mercado, Porte, StatusDoCadastro } from "./tipos";

export const ROTULOS_DE_MERCADO: Record<Mercado, string> = { PRACA: "Praça", MONTADORA: "Montadora", EXPORTACAO: "Exportação" };

export const ROTULOS_DE_PORTE: Record<Porte, string> = { pequeno: "pequeno", medio: "médio", grande: "grande" };

/** Os nomes do SGI, como o representante os ouve da equipe de vendas. */
export const ROTULOS_DE_STATUS: Record<StatusDoCadastro, string> = { ativo: "Ativo", inativo: "Inativo", substituido: "Substituído" };
