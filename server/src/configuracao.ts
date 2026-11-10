import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import type { PastasDaFoto } from "./foto/conferirFoto.ts";
import type { LoginProvisorio } from "./login/loginProvisorio.ts";

/*
 * Configuração do servidor, lida do server/.env (fora do git; as chaves estão em .env.example).
 * Fora da produção, tudo tem valor padrão para rodar neste computador.
 */

export type ConfiguracaoDoServidor = {
  porta: number;
  fotos: PastasDaFoto;
  /** O app.db: usuários, chaves, sessões e auditoria. */
  arquivoDoApp: string;
  /** O endereço do CRM: a chave de acesso fica presa a ele, e os POSTs só valem dele. */
  origem: string;
  /** A porta da API da administração, também só nesta máquina. */
  portaDoAdmin: number;
  /** O endereço da administração, que nunca fica na internet. */
  origemDoAdmin: string;
  /** Só na rede interna (lerConfiguracaoDaRedeInterna). */
  loginProvisorio?: LoginProvisorio;
};

const PASTA_DO_SERVIDOR = path.resolve(import.meta.dirname, "..");
const PORTA_PADRAO = 5176;
const PORTA_PADRAO_DO_ADMIN = 5178;
/** Os sites do Vite neste computador (web/vite.config.ts e web/vite.admin.config.ts). A chave de acesso aceita "localhost" sem https. */
const ORIGEM_DO_CRM_NESTE_COMPUTADOR = "http://localhost:5175";
const ORIGEM_DO_ADMIN_NESTE_COMPUTADOR = "http://localhost:5179";

/** O arquivo do login provisório da rede interna, em data/, fora do git como tudo o que fica lá. */
export const ARQUIVO_DA_REDE_INTERNA = path.resolve(PASTA_DO_SERVIDOR, "../data/rede-interna.env");
const REDE_INTERNA = {
  porta: 5186,
  portaDoAdmin: 5188,
  arquivoDoApp: path.resolve(PASTA_DO_SERVIDOR, "../data/app-rede-interna.db"),
};
const IP_DE_REDE_INTERNA = /^(10\.\d+|192\.168|172\.(1[6-9]|2\d|3[01]))\.\d+\.\d+$/;
const FORMATO_DOS_CODIGOS = /^\d{1,9}(,\d{1,9})*$/;

export function lerConfiguracao(): ConfiguracaoDoServidor {
  return lerConfiguracaoDe(lerEnv(path.join(PASTA_DO_SERVIDOR, ".env")));
}

/**
 * O CRM com os dados reais na rede interna, com o login provisório por senha (login/loginProvisorio.ts).
 * Nunca na produção. Tem app.db e portas só dele, para o login fraco não conviver com as chaves de
 * acesso; o endereço, que o iniciar-crm-servidor.bat passa em CRM_ORIGEM_DA_REDE_INTERNA, tem de ser
 * http no IP de rede interna; a senha e os códigos ficam em data/rede-interna.env.
 */
export function lerConfiguracaoDaRedeInterna(env: NodeJS.ProcessEnv = process.env, arquivo = ARQUIVO_DA_REDE_INTERNA): ConfiguracaoDoServidor {
  if (env.NODE_ENV === "production") throw new Error("O login provisório da rede interna não roda na produção.");
  const origem = lerOrigemDaRedeInterna(env.CRM_ORIGEM_DA_REDE_INTERNA);
  if (!fs.existsSync(arquivo)) throw new Error(`Falta ${arquivo}, com CRM_SENHA_PROVISORIA e CRM_LOGIN_PROVISORIO_CODIGOS (ex.: 1401,1402).`);
  const { CRM_SENHA_PROVISORIA: senha = "", CRM_LOGIN_PROVISORIO_CODIGOS: codigos = "" } = lerEnv(arquivo);
  if (!senha) throw new Error(`Falta CRM_SENHA_PROVISORIA em ${arquivo}.`);
  if (!FORMATO_DOS_CODIGOS.test(codigos)) throw new Error(`CRM_LOGIN_PROVISORIO_CODIGOS, em ${arquivo}, são os códigos de representante separados por vírgula (ex.: 1401,1402).`);
  return { ...lerConfiguracao(), ...REDE_INTERNA, origem, loginProvisorio: { senha, codigos: codigos.split(",") } };
}

function lerEnv(arquivo: string): Record<string, string | undefined> {
  return fs.existsSync(arquivo) ? parseEnv(fs.readFileSync(arquivo, "utf8")) : {};
}

function lerOrigemDaRedeInterna(valor: string | undefined): string {
  const url = new URL(valor ?? "http://sem-endereco");
  if (url.protocol !== "http:" || !IP_DE_REDE_INTERNA.test(url.hostname) || url.origin !== valor) {
    throw new Error(`CRM_ORIGEM_DA_REDE_INTERNA é o endereço do site na rede interna, http, IP e porta (ex.: http://192.168.0.50:4175): ${valor ?? "vazio"}`);
  }
  return valor;
}

function lerConfiguracaoDe(env: Record<string, string | undefined>): ConfiguracaoDoServidor {
  return {
    porta: Number(env.CRM_PORTA || PORTA_PADRAO),
    fotos: {
      entrada: path.resolve(PASTA_DO_SERVIDOR, env.CRM_PASTA_DE_ENTRADA || "../data/fotos"),
      conferidas: path.resolve(PASTA_DO_SERVIDOR, env.CRM_PASTA_DAS_FOTOS_CONFERIDAS || "../data/fotos-conferidas"),
    },
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
