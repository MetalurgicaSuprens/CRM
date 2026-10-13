/** O pedaço do driver que o extrator usa (oracle.ts). O pacote não traz tipos. */
declare module "oracledb" {
  type Execucao<T> = { rows?: T[] };

  type Conexao = {
    callTimeout: number;
    execute<T>(
      sql: string,
      binds: Record<string, unknown>,
      opcoes: { outFormat: number; fetchArraySize: number },
    ): Promise<Execucao<T>>;
    close(): Promise<void>;
  };

  const oracledb: {
    OUT_FORMAT_ARRAY: number;
    getConnection(dados: { user: string; password: string; connectString: string }): Promise<Conexao>;
  };

  export default oracledb;
}
