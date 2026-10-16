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
  /** A porta da API da administração, também só nesta máquina. */
  portaDoAdmin: number;
  /** O endereço da administração, que nunca fica na internet. */
  origemDoAdmin: string;
};

const PASTA_DO_SERVIDOR = path.resolve(import.meta.dirname, "..");
const PORTA_PADRAO = 5176;
const PORTA_PADRAO_DO_ADMIN = 5178;
/** Os sites do Vite neste computador (web/vite.config.ts e web/vite.admin.config.ts). A chave de acesso aceita "localhost" sem https. */
const ORIGEM_DO_CRM_NESTE_COMPUTADOR = "http://localhost:5175";
const ORIGEM_DO_ADMIN_NESTE_COMPUTADOR = "http://localhost:5179";

export function lerConfiguracao(): ConfiguracaoDoServidor {
  const arquivo = path.join(PASTA_DO_SERVIDOR, ".env");
  const env = fs.existsSync(arquivo) ? parseEnv(fs.readFileSync(arquivo, "utf8")) : {};
  return {
    porta: Number(env.CRM_PORTA || PORTA_PADRAO),
    pastaDasFotos: path.resolve(PASTA_DO_SERVIDOR, env.CRM_PASTA_DAS_FOTOS || "../data/fotos"),
    arquivoDoApp: path.resolve(PASTA_DO_SERVIDOR, env.CRM_ARQUIVO_DO_APP || "../data/app.db"),
    origem: lerOrigem("CRM_ORIGEM", env.CRM_ORIGEM, ORIGEM_DO_CRM_NESTE_COMPUTADOR),
    portaDoAdmin: Number(env.CRM_PORTA_DO_ADMIN || PORTA_PADRAO_DO_ADMIN),
    origemDoAdmin: lerOrigem("CRM_ORIGEM_DO_ADMIN", env.CRM_ORIGEM_DO_ADMIN, ORIGEM_DO_ADMIN_NESTE_COMPUTADOR),
  };
}

/**
 * Na produção, o endereço é obrigatório e com https; só "localhost" vale sem, porque o navegador o
 * trata como seguro (a administração pode ser aberta por um túnel SSH até o servidor).
 */
function lerOrigem(chave: string, valor: string | undefined, nesteComputador: string): string {
  const isProducao = process.env.NODE_ENV === "production";
  if (!valor) {
    if (isProducao) throw new Error(`Falta ${chave}, o endereço do site (ex.: https://crm.suprens.com.br).`);
    return nesteComputador;
  }
  const { origin, protocol, hostname } = new URL(valor);
  if (origin !== valor) throw new Error(`${chave} é só esquema, domínio e porta, sem caminho nem barra no fim: ${origin}`);
  if (isProducao && protocol !== "https:" && hostname !== "localhost") throw new Error(`Na produção, ${chave} usa https.`);
  return valor;
}
