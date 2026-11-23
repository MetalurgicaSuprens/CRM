import oracledb from "oracledb";

/*
 * Única porta do extrator para o Oracle, uma conexão por passada. A foto e a conferência só leem. A
 * gravação do pedido no SGI chama as procedures de pedido numa transação que só vale com confirmar():
 * nada se grava sozinho (autoCommit desligado), e fechar a conexão sem confirmar desfaz tudo.
 */

export type AcessoAoOracle = {
  usuario: string;
  senha: string;
  endereco: string;
  /** De onde vêm as tabelas restritas: ABC71 na conta de desenvolvimento, CRM_DADOS na conta do extrator. */
  esquemaDasTabelasRestritas: string;
};

/** Uma linha da consulta, coluna a coluna, na ordem do SELECT. */
export type Linha = readonly unknown[];

export type Oracle = {
  consultar(sql: string, binds?: Record<string, unknown>): Promise<Linha[]>;
  /** Um bloco PL/SQL (a chamada de uma procedure), dentro da transação aberta. */
  executar(plsql: string, binds: Record<string, unknown>): Promise<void>;
  confirmar(): Promise<void>;
  desfazer(): Promise<void>;
  fechar(): Promise<void>;
};

const LINHAS_POR_VIAGEM = 5_000;
const TEMPO_MAXIMO_POR_CONSULTA_MS = 300_000;
/**
 * As tabelas do Omega com dados bancários ou de crédito. A conta do extrator não as lê: lê views do
 * esquema CRM_DADOS, com o mesmo nome e sem essas colunas (docs/conta-oracle-do-crm.md, item 3).
 */
const TABELAS_RESTRITAS = /\bABC71\.(CRCL|CFOR|NFME|VEPM)\b/g;

/** O SQL com as tabelas restritas lidas do esquema das views. Com o ABC71, fica igual. */
export function apontarTabelasRestritas(sql: string, esquema: string): string {
  return sql.replace(TABELAS_RESTRITAS, `${esquema}.$1`);
}

export async function abrirOracle(acesso: AcessoAoOracle): Promise<Oracle> {
  const conexao = await oracledb.getConnection({ user: acesso.usuario, password: acesso.senha, connectString: acesso.endereco });
  conexao.callTimeout = TEMPO_MAXIMO_POR_CONSULTA_MS;
  return {
    async consultar(sql, binds = {}) {
      const resultado = await conexao.execute<Linha>(apontarTabelasRestritas(sql, acesso.esquemaDasTabelasRestritas), binds, {
        outFormat: oracledb.OUT_FORMAT_ARRAY,
        fetchArraySize: LINHAS_POR_VIAGEM,
      });
      return resultado.rows ?? [];
    },
    async executar(plsql, binds) {
      await conexao.execute(apontarTabelasRestritas(plsql, acesso.esquemaDasTabelasRestritas), binds, { autoCommit: false });
    },
    confirmar: () => conexao.commit(),
    desfazer: () => conexao.rollback(),
    fechar: () => conexao.close(),
  };
}
