import type { Linha, Oracle } from "./oracle.ts";

/*
 * Um Oracle de mentira para os testes: responde às consultas com o que o teste mandar e guarda tudo o
 * que recebeu, na ordem, para o teste conferir o SQL, as chamadas de procedure e a transação.
 */

export type ChamadaAoOracle =
  | { tipo: "consulta"; sql: string; binds: Record<string, unknown> }
  | { tipo: "execucao"; plsql: string; binds: Record<string, unknown> }
  | { tipo: "confirmar" | "desfazer" | "fechar" };

export type OracleDeTeste = Oracle & { chamadas: ChamadaAoOracle[] };

export type RespostasDoOracle = {
  consultar?: (sql: string, binds: Record<string, unknown>) => Linha[] | Promise<Linha[]>;
  executar?: (plsql: string, binds: Record<string, unknown>) => void | Promise<void>;
};

export function oracleDeTeste({ consultar = () => [], executar = () => {} }: RespostasDoOracle = {}): OracleDeTeste {
  const chamadas: ChamadaAoOracle[] = [];
  return {
    chamadas,
    async consultar(sql, binds = {}) {
      chamadas.push({ tipo: "consulta", sql, binds });
      return consultar(sql, binds);
    },
    async executar(plsql, binds) {
      chamadas.push({ tipo: "execucao", plsql, binds });
      await executar(plsql, binds);
    },
    async confirmar() {
      chamadas.push({ tipo: "confirmar" });
    },
    async desfazer() {
      chamadas.push({ tipo: "desfazer" });
    },
    async fechar() {
      chamadas.push({ tipo: "fechar" });
    },
  };
}
