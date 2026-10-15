import type { DatabaseSync, SQLInputValue, SQLOutputValue } from "node:sqlite";
import type { Mercado, Situacao, StatusDoCadastro } from "dominio/tipos";
import type { ClienteResumo } from "../../../web/src/dados/tipos.ts";
import type { Sessao } from "../sessao.ts";

/*
 * Leitura da foto com o escopo da sessão: toda consulta que devolve dado de representante recebe
 * os códigos do login, e nenhum código vem do navegador (CLAUDE.md, regra 4).
 */

export type Linha = Record<string, SQLOutputValue>;

export function lerLinhas(db: DatabaseSync, sql: string, parametros: SQLInputValue[] = []): Linha[] {
  return db.prepare(sql).all(...parametros);
}

/** A linha única da tabela `foto`: data de referência, mês, dias úteis e semestre. */
export function lerDadosDaFoto(db: DatabaseSync): Linha {
  const [linha] = lerLinhas(db, "SELECT * FROM foto");
  if (!linha) throw new Error("A foto não tem a linha de referência.");
  return linha;
}

/** "?, ?" para o IN e os códigos da sessão, na mesma ordem. */
export function escopo(sessao: Sessao): { marcas: string; codigos: string[] } {
  return { marcas: sessao.codigos.map(() => "?").join(", "), codigos: sessao.codigos };
}

export function texto(linha: Linha, coluna: string): string {
  return String(linha[coluna] ?? "");
}

export function textoOuNulo(linha: Linha, coluna: string): string | null {
  const valor = linha[coluna];
  return valor === null || valor === undefined ? null : String(valor);
}

export function numero(linha: Linha, coluna: string): number {
  return Number(linha[coluna] ?? 0);
}

export function numeroOuNulo(linha: Linha, coluna: string): number | null {
  const valor = linha[coluna];
  return valor === null || valor === undefined ? null : Number(valor);
}

/**
 * Colunas de `cliente` (alias c) que formam o ClienteResumo. A queda do semestre só existe em
 * `analise_ritmo` para quem está em risco: o extrator grava "menos" só nesse caso.
 */
export const COLUNAS_DO_RESUMO = `c.cliente, c.codigo_erp, c.nome, c.cidade, c.uf, c.mercado, c.situacao, c.status, c.ultima_compra,
  c.faturamento_12m, c.variacao_12m, c.evolucao_12m,
  (SELECT r.variacao FROM analise_ritmo r WHERE r.cliente = c.cliente AND r.direcao = 'menos') AS queda_no_semestre`;

export function resumoDoCliente(linha: Linha): ClienteResumo {
  return {
    codigo: texto(linha, "cliente"),
    codigoErp: textoOuNulo(linha, "codigo_erp"),
    nome: texto(linha, "nome"),
    cidade: texto(linha, "cidade"),
    uf: texto(linha, "uf"),
    mercado: texto(linha, "mercado") as Mercado,
    situacao: texto(linha, "situacao") as Situacao,
    status: texto(linha, "status") as StatusDoCadastro,
    ultimaCompra: textoOuNulo(linha, "ultima_compra"),
    faturamento12m: numero(linha, "faturamento_12m"),
    variacao12m: numeroOuNulo(linha, "variacao_12m"),
    evolucao12m: JSON.parse(texto(linha, "evolucao_12m")) as number[],
    quedaNoSemestre: numeroOuNulo(linha, "queda_no_semestre"),
  };
}
