import oracledb from "oracledb";

/*
 * Única porta do extrator para o Oracle: só leitura, uma conexão por foto.
 */

export type AcessoAoOracle = { usuario: string; senha: string; endereco: string };

/** Uma linha da consulta, coluna a coluna, na ordem do SELECT. */
export type Linha = readonly unknown[];

export type Oracle = {
  consultar(sql: string, binds?: Record<string, unknown>): Promise<Linha[]>;
  fechar(): Promise<void>;
};

const LINHAS_POR_VIAGEM = 5_000;
const TEMPO_MAXIMO_POR_CONSULTA_MS = 300_000;

export async function abrirOracle(acesso: AcessoAoOracle): Promise<Oracle> {
  const conexao = await oracledb.getConnection({ user: acesso.usuario, password: acesso.senha, connectString: acesso.endereco });
  conexao.callTimeout = TEMPO_MAXIMO_POR_CONSULTA_MS;
  return {
    async consultar(sql, binds = {}) {
      const resultado = await conexao.execute<Linha>(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_ARRAY,
        fetchArraySize: LINHAS_POR_VIAGEM,
      });
      return resultado.rows ?? [];
    },
    fechar: () => conexao.close(),
  };
}
