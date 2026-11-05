import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseArgs, parseEnv } from "node:util";
import { APELIDO_DO_SERVIDOR, type DestinoDoEnvio } from "./envio/sftp.ts";
import type { FontesDaLocalizacao } from "./localizacao/localizarClientes.ts";
import type { AcessoAoOracle } from "./oracle.ts";

/*
 * O que o extrator precisa para rodar. Tudo fica na máquina da LAN, fora do git:
 * - o .env com o acesso ao Oracle e o endereço do servidor do CRM (só os nomes das chaves estão em .env.example);
 * - a chave do extrator e a do servidor do CRM, para o envio (envio/);
 * - a lista de representantes autorizados, mantida pelo Lucas;
 * - a chave do id dos clientes, criada na primeira execução;
 * - os arquivos do CNEFE do IBGE (cnefe/) e os pontos já achados (localizacao/localizarClientes.ts).
 */

export type Configuracao = {
  oracle: AcessoAoOracle;
  /** Códigos dos representantes que entram na foto. */
  autorizados: string[];
  chaveDoIdDoCliente: Buffer;
  pastaDasFotos: string;
  localizacao: FontesDaLocalizacao;
  /** Grava a foto mesmo que ela mude demais desde a anterior (foto/comparacao.ts). */
  aceitarMudanca: boolean;
};

/** O que o envio da foto ao servidor do CRM precisa (envio/enviarFoto.ts). Não lê o Oracle. */
export type ConfiguracaoDoEnvio = {
  pastaDasFotos: string;
  destino: DestinoDoEnvio;
};

const PASTA_DO_EXTRATOR = path.resolve(import.meta.dirname, "..");
const PASTA_DE_DADOS_PADRAO = path.resolve(PASTA_DO_EXTRATOR, "..", "data");
const ARQUIVO_DE_AUTORIZADOS = "representantes-autorizados.txt";
const ARQUIVO_DA_CHAVE = "chave-do-id-do-cliente";
const BYTES_DA_CHAVE = 32;
const CHAVES_DO_ORACLE = ["ORACLE_USER", "ORACLE_PASSWORD", "ORACLE_HOST", "ORACLE_SERVICE_NAME"] as const;
const PASTA_DAS_FOTOS = "fotos";
const PASTA_DO_ENVIO = "envio";
const ARQUIVO_DA_CHAVE_DO_EXTRATOR = "chave-do-extrator";
const ARQUIVO_DO_SERVIDOR_CONHECIDO = "servidor-conhecido";
const PORTA_PADRAO_DO_SERVIDOR = 22;
const USUARIO_PADRAO_NO_SERVIDOR = "crm-troca";
/** O endereço e o usuário entram no comando do programa de envio: só letras, números, ponto e hífen. */
const ENDERECO_DO_SERVIDOR = /^[A-Za-z0-9][A-Za-z0-9.-]*$/;
const USUARIO_NO_SERVIDOR = /^[a-z_][a-z0-9_-]*$/;

/**
 * `--env <arquivo>` troca o .env do extrator; `--dados <pasta>` troca a pasta de dados;
 * `--aceitar-mudanca` grava a foto sem compará-la com a anterior.
 */
export function lerConfiguracao(argumentos: string[]): Configuracao {
  const { values } = parseArgs({
    args: argumentos,
    options: { env: { type: "string" }, dados: { type: "string" }, "aceitar-mudanca": { type: "boolean", default: false } },
  });
  const pastaDeDados = path.resolve(values.dados ?? PASTA_DE_DADOS_PADRAO);
  return {
    oracle: lerAcessoAoOracle(path.resolve(values.env ?? path.join(PASTA_DO_EXTRATOR, ".env"))),
    autorizados: lerAutorizados(path.join(pastaDeDados, ARQUIVO_DE_AUTORIZADOS)),
    chaveDoIdDoCliente: lerOuCriarChave(path.join(pastaDeDados, ARQUIVO_DA_CHAVE)),
    pastaDasFotos: path.join(pastaDeDados, PASTA_DAS_FOTOS),
    localizacao: { pastaDoCnefe: path.join(pastaDeDados, "cnefe"), arquivoDosPontos: path.join(pastaDeDados, "pontos-dos-enderecos.db") },
    aceitarMudanca: values["aceitar-mudanca"],
  };
}

/** `--env <arquivo>` e `--dados <pasta>`, como na foto. */
export function lerConfiguracaoDoEnvio(argumentos: string[]): ConfiguracaoDoEnvio {
  const { values } = parseArgs({ args: argumentos, options: { env: { type: "string" }, dados: { type: "string" } } });
  const pastaDeDados = path.resolve(values.dados ?? PASTA_DE_DADOS_PADRAO);
  const arquivoEnv = path.resolve(values.env ?? path.join(PASTA_DO_EXTRATOR, ".env"));
  const env = lerEnv(arquivoEnv);
  const pastaDoEnvio = path.join(pastaDeDados, PASTA_DO_ENVIO);
  return {
    pastaDasFotos: path.join(pastaDeDados, PASTA_DAS_FOTOS),
    destino: {
      endereco: exigirNoFormato(env.CRM_SERVIDOR, ENDERECO_DO_SERVIDOR, `CRM_SERVIDOR, no ${arquivoEnv}`),
      porta: lerPorta(env.CRM_SERVIDOR_PORTA),
      usuario: exigirNoFormato(env.CRM_SERVIDOR_USUARIO || USUARIO_PADRAO_NO_SERVIDOR, USUARIO_NO_SERVIDOR, `CRM_SERVIDOR_USUARIO, no ${arquivoEnv}`),
      chave: exigirArquivo(path.join(pastaDoEnvio, ARQUIVO_DA_CHAVE_DO_EXTRATOR), "a chave do extrator, que o servidor do CRM conhece"),
      servidorConhecido: exigirArquivo(
        path.join(pastaDoEnvio, ARQUIVO_DO_SERVIDOR_CONHECIDO),
        `a chave do servidor do CRM, numa linha "${APELIDO_DO_SERVIDOR} ssh-ed25519 ..."`,
      ),
    },
  };
}

function lerEnv(arquivo: string): NodeJS.Dict<string> {
  if (!fs.existsSync(arquivo)) throw new Error(`Falta o arquivo ${arquivo}, com as chaves de extrator/.env.example.`);
  return parseEnv(fs.readFileSync(arquivo, "utf8"));
}

function exigirNoFormato(valor: string | undefined, formato: RegExp, nome: string): string {
  if (!valor || !formato.test(valor)) throw new Error(`Falta ${nome}, ou está fora do formato.`);
  return valor;
}

function lerPorta(valor: string | undefined): number {
  const porta = Number(valor || PORTA_PADRAO_DO_SERVIDOR);
  if (!Number.isInteger(porta) || porta < 1 || porta > 65_535) throw new Error(`CRM_SERVIDOR_PORTA não é uma porta: "${valor}".`);
  return porta;
}

function exigirArquivo(arquivo: string, descricao: string): string {
  if (!fs.existsSync(arquivo)) throw new Error(`Falta ${arquivo}: ${descricao}.`);
  return arquivo;
}

function lerAcessoAoOracle(arquivo: string): AcessoAoOracle {
  const env = lerEnv(arquivo);
  const faltando = CHAVES_DO_ORACLE.filter((chave) => !env[chave]);
  if (faltando.length > 0) throw new Error(`Faltam no ${arquivo}: ${faltando.join(", ")}.`);
  return {
    usuario: env.ORACLE_USER ?? "",
    senha: env.ORACLE_PASSWORD ?? "",
    endereco: `${env.ORACLE_HOST}:${env.ORACLE_PORT || "1521"}/${env.ORACLE_SERVICE_NAME}`,
  };
}

/** Um código por linha; o que vem depois de # é comentário. */
export function lerAutorizados(arquivo: string): string[] {
  if (!fs.existsSync(arquivo)) {
    throw new Error(`Falta ${arquivo}: escreva nele os códigos dos representantes autorizados, um por linha.`);
  }
  const codigos = fs
    .readFileSync(arquivo, "utf8")
    .split(/\r?\n/)
    .map((linha) => linha.replace(/#.*/, "").trim())
    .filter((linha) => linha !== "");
  const invalido = codigos.find((codigo) => !/^\d{1,9}$/.test(codigo));
  if (invalido !== undefined) throw new Error(`Código de representante inválido em ${arquivo}: "${invalido}".`);
  if (codigos.length === 0) throw new Error(`Nenhum representante autorizado em ${arquivo}.`);
  return [...new Set(codigos)];
}

/**
 * A chave do id dos clientes nunca sai da LAN. Ela precisa durar: com outra chave, os ids mudam e
 * os rascunhos e pedidos guardados no CRM perdem o cliente.
 */
function lerOuCriarChave(arquivo: string): Buffer {
  if (!fs.existsSync(arquivo)) {
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    fs.writeFileSync(arquivo, crypto.randomBytes(BYTES_DA_CHAVE).toString("hex"), { mode: 0o600, flag: "wx" });
  }
  const chave = Buffer.from(fs.readFileSync(arquivo, "utf8").trim(), "hex");
  if (chave.length !== BYTES_DA_CHAVE) throw new Error(`A chave em ${arquivo} não tem ${BYTES_DA_CHAVE} bytes.`);
  return chave;
}
