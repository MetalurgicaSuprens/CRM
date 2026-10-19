import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseArgs, parseEnv } from "node:util";
import type { FontesDaLocalizacao } from "./localizacao/localizarClientes.ts";
import type { AcessoAoOracle } from "./oracle.ts";

/*
 * O que o extrator precisa para rodar. Tudo fica na máquina da LAN, fora do git:
 * - o .env com o acesso ao Oracle (só os nomes das chaves estão em .env.example);
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
};

const PASTA_DO_EXTRATOR = path.resolve(import.meta.dirname, "..");
const PASTA_DE_DADOS_PADRAO = path.resolve(PASTA_DO_EXTRATOR, "..", "data");
const ARQUIVO_DE_AUTORIZADOS = "representantes-autorizados.txt";
const ARQUIVO_DA_CHAVE = "chave-do-id-do-cliente";
const BYTES_DA_CHAVE = 32;
const CHAVES_DO_ORACLE = ["ORACLE_USER", "ORACLE_PASSWORD", "ORACLE_HOST", "ORACLE_SERVICE_NAME"] as const;

/** `--env <arquivo>` troca o .env do extrator; `--dados <pasta>` troca a pasta de dados. */
export function lerConfiguracao(argumentos: string[]): Configuracao {
  const { values } = parseArgs({ args: argumentos, options: { env: { type: "string" }, dados: { type: "string" } } });
  const pastaDeDados = path.resolve(values.dados ?? PASTA_DE_DADOS_PADRAO);
  return {
    oracle: lerAcessoAoOracle(path.resolve(values.env ?? path.join(PASTA_DO_EXTRATOR, ".env"))),
    autorizados: lerAutorizados(path.join(pastaDeDados, ARQUIVO_DE_AUTORIZADOS)),
    chaveDoIdDoCliente: lerOuCriarChave(path.join(pastaDeDados, ARQUIVO_DA_CHAVE)),
    pastaDasFotos: path.join(pastaDeDados, "fotos"),
    localizacao: { pastaDoCnefe: path.join(pastaDeDados, "cnefe"), arquivoDosPontos: path.join(pastaDeDados, "pontos-dos-enderecos.db") },
  };
}

function lerAcessoAoOracle(arquivo: string): AcessoAoOracle {
  if (!fs.existsSync(arquivo)) throw new Error(`Falta o arquivo ${arquivo}, com as chaves de extrator/.env.example.`);
  const env = parseEnv(fs.readFileSync(arquivo, "utf8"));
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
