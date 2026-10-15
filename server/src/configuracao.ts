import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

/*
 * Configuração do servidor, lida do server/.env (fora do git; as chaves estão em .env.example).
 * Fora da produção, tudo tem valor padrão para rodar neste computador.
 */

export type ConfiguracaoDoServidor = {
  porta: number;
  pastaDasFotos: string;
  /** O app.db: usuários, chaves, sessões e auditoria. */
  arquivoDoApp: string;
  /** O endereço do CRM: a chave de acesso fica presa a ele, e os POSTs só valem dele. */
  origem: string;
};

const PASTA_DO_SERVIDOR = path.resolve(import.meta.dirname, "..");
const PORTA_PADRAO = 5176;
/** O site do Vite neste computador (web/vite.config.ts). A chave de acesso aceita "localhost" sem https. */
const ORIGEM_DESTE_COMPUTADOR = "http://localhost:5175";

export function lerConfiguracao(): ConfiguracaoDoServidor {
  const arquivo = path.join(PASTA_DO_SERVIDOR, ".env");
  const env = fs.existsSync(arquivo) ? parseEnv(fs.readFileSync(arquivo, "utf8")) : {};
  return {
    porta: Number(env.CRM_PORTA || PORTA_PADRAO),
    pastaDasFotos: path.resolve(PASTA_DO_SERVIDOR, env.CRM_PASTA_DAS_FOTOS || "../data/fotos"),
    arquivoDoApp: path.resolve(PASTA_DO_SERVIDOR, env.CRM_ARQUIVO_DO_APP || "../data/app.db"),
    origem: lerOrigem(env.CRM_ORIGEM),
  };
}

function lerOrigem(valor: string | undefined): string {
  const isProducao = process.env.NODE_ENV === "production";
  if (!valor) {
    if (isProducao) throw new Error("Falta CRM_ORIGEM, o endereço do CRM (ex.: https://crm.suprens.com.br).");
    return ORIGEM_DESTE_COMPUTADOR;
  }
  const { origin, protocol } = new URL(valor);
  if (origin !== valor) throw new Error(`CRM_ORIGEM é só esquema, domínio e porta, sem caminho nem barra no fim: ${origin}`);
  if (isProducao && protocol !== "https:") throw new Error("Na produção, CRM_ORIGEM usa https.");
  return valor;
}
