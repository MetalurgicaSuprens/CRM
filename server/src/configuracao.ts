import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

/*
 * Configuração do servidor, lida do server/.env (fora do git; as chaves estão em .env.example).
 */

export type ConfiguracaoDoServidor = {
  porta: number;
  pastaDasFotos: string;
  /** Login fixo deste computador, enquanto a F3 não traz o login de verdade. */
  sessaoDeTeste: { nome: string; codigos: string[] } | null;
};

const PASTA_DO_SERVIDOR = path.resolve(import.meta.dirname, "..");
const PORTA_PADRAO = 5176;

export function lerConfiguracao(): ConfiguracaoDoServidor {
  const arquivo = path.join(PASTA_DO_SERVIDOR, ".env");
  const env = fs.existsSync(arquivo) ? parseEnv(fs.readFileSync(arquivo, "utf8")) : {};
  return {
    porta: Number(env.CRM_PORTA || PORTA_PADRAO),
    pastaDasFotos: path.resolve(PASTA_DO_SERVIDOR, env.CRM_PASTA_DAS_FOTOS || "../data/fotos"),
    sessaoDeTeste: lerSessaoDeTeste(env),
  };
}

function lerSessaoDeTeste(env: Record<string, string | undefined>): ConfiguracaoDoServidor["sessaoDeTeste"] {
  const codigos = (env.CRM_SESSAO_DE_TESTE_CODIGOS ?? "")
    .split(",")
    .map((codigo) => codigo.trim())
    .filter((codigo) => codigo !== "");
  if (codigos.length === 0) return null;
  if (process.env.NODE_ENV === "production") throw new Error("A sessão de teste não vale em produção.");
  const invalido = codigos.find((codigo) => !/^\d{1,9}$/.test(codigo));
  if (invalido !== undefined) throw new Error(`Código de representante inválido em CRM_SESSAO_DE_TESTE_CODIGOS: "${invalido}".`);
  return { nome: env.CRM_SESSAO_DE_TESTE_NOME || "Teste", codigos };
}
