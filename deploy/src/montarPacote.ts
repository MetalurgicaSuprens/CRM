import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { arquivosProibidos } from "./conteudoDoPacote.ts";

/*
 * npm run pacote: monta neste computador o pacote que vai para o servidor do CRM (docs/plano.md,
 * "Publicação"). O servidor nunca roda npm nem git: ele recebe o código da API, as dependências de
 * produção já instaladas e os dois sites prontos, e o deploy/publicar.sh só desempacota e troca a versão.
 * O pacote sai de um commit, para se saber exatamente o que está no ar; --rascunho aceita mudança sem
 * commit, só para testar o pacote.
 */

const RAIZ = path.resolve(import.meta.dirname, "../..");
const PASTA_DOS_PACOTES = path.join(RAIZ, "deploy", "pacotes");
/** O npm só instala com a lista de todos os pacotes do repositório; os que não vão ao servidor saem depois. */
const PACOTES_QUE_FICAM_AQUI = ["extrator", "web", "deploy"];
const PACOTES_QUE_VAO = ["dominio", "server"];
/** Os testes e a foto de teste só servem aqui. */
const isSoParaTeste = (nome: string) => nome.endsWith(".test.ts") || nome === "fotoDeTeste.ts";

const { values: opcoes } = parseArgs({ options: { rascunho: { type: "boolean", default: false } } });

const versao = nomeDaVersao(opcoes.rascunho);
console.log(`Montando o pacote ${versao}...`);
montarOsSites();
const pasta = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "crm-pacote-")), versao);
copiarOCodigo(pasta);
instalarAsDependenciasDeProducao(pasta);
copiarOsSites(pasta);
fs.writeFileSync(path.join(pasta, "VERSAO"), `${versao}\n`);
conferirOConteudo(pasta);
const arquivo = compactar(pasta);
fs.rmSync(path.dirname(pasta), { recursive: true, force: true });
console.log(`Pacote pronto: ${arquivo}`);
console.log("Leve-o ao servidor e rode: sudo /opt/crm/publicar.sh <pacote> (deploy/README.md).");

function nomeDaVersao(isRascunho: boolean): string {
  const mudancas = git("status", "--porcelain");
  if (mudancas && !isRascunho) throw new Error(`Há mudança sem commit; o pacote sai de um commit.\n${mudancas}`);
  const agora = new Date();
  const data = `${agora.getFullYear()}${doisDigitos(agora.getMonth() + 1)}${doisDigitos(agora.getDate())}-${doisDigitos(agora.getHours())}${doisDigitos(agora.getMinutes())}`;
  return `crm-${data}-${git("rev-parse", "--short", "HEAD")}${isRascunho ? "-rascunho" : ""}`;
}

function doisDigitos(numero: number): string {
  return String(numero).padStart(2, "0");
}

function montarOsSites(): void {
  npm(RAIZ, "run", "build:real", "--workspace", "web");
  npm(RAIZ, "run", "build:admin", "--workspace", "web");
}

function copiarOCodigo(destino: string): void {
  for (const arquivo of ["package.json", "package-lock.json", ".npmrc"]) copiar(arquivo, destino);
  for (const pacote of PACOTES_QUE_FICAM_AQUI) copiar(path.join(pacote, "package.json"), destino);
  for (const pacote of PACOTES_QUE_VAO) {
    fs.cpSync(path.join(RAIZ, pacote), path.join(destino, pacote), {
      recursive: true,
      filter: (origem) => !origem.includes(`${path.sep}node_modules`) && !isSoParaTeste(path.basename(origem)) && path.basename(origem) !== ".env",
    });
  }
}

function copiar(relativo: string, destino: string): void {
  fs.mkdirSync(path.dirname(path.join(destino, relativo)), { recursive: true });
  fs.copyFileSync(path.join(RAIZ, relativo), path.join(destino, relativo));
}

/**
 * As dependências do servidor são só JavaScript, então as instaladas aqui valem no Linux. Os pacotes do
 * próprio repositório entram em node_modules como atalhos para a pasta deles; o tar não os leva, e o
 * publicar.sh recria o do dominio no servidor.
 */
function instalarAsDependenciasDeProducao(pasta: string): void {
  npm(pasta, "ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund", "--workspace", "server");
  for (const pacote of [...PACOTES_QUE_FICAM_AQUI, ...PACOTES_QUE_VAO]) {
    fs.rmSync(path.join(pasta, "node_modules", pacote), { force: true });
  }
  fs.rmSync(path.join(pasta, "node_modules", ".bin"), { recursive: true, force: true });
  for (const pacote of PACOTES_QUE_FICAM_AQUI) fs.rmSync(path.join(pasta, pacote), { recursive: true });
}

function copiarOsSites(pasta: string): void {
  fs.cpSync(path.join(RAIZ, "web", "dist"), path.join(pasta, "site"), { recursive: true });
  fs.cpSync(path.join(RAIZ, "web", "dist-admin"), path.join(pasta, "admin"), { recursive: true });
}

function conferirOConteudo(pasta: string): void {
  const caminhos = fs.readdirSync(pasta, { recursive: true, encoding: "utf8" });
  const proibidos = arquivosProibidos(caminhos);
  if (proibidos.length > 0) throw new Error(`O pacote levaria arquivos que não podem sair daqui:\n${proibidos.join("\n")}`);
}

function compactar(pasta: string): string {
  fs.mkdirSync(PASTA_DOS_PACOTES, { recursive: true });
  const arquivo = path.join(PASTA_DOS_PACOTES, `${path.basename(pasta)}.tar.gz`);
  execFileSync(programaTar(), ["-czf", arquivo, "-C", path.dirname(pasta), path.basename(pasta)], { stdio: "inherit" });
  return arquivo;
}

/** O tar do Windows, e não o do Git, que confunde "D:" com o nome de outro computador. */
function programaTar(): string {
  if (process.platform !== "win32") return "tar";
  return path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
}

function git(...argumentos: string[]): string {
  return execFileSync("git", argumentos, { cwd: RAIZ, encoding: "utf8" }).trim();
}

/** O mesmo npm que rodou o npm run pacote, pelo Node, sem passar pelo shell (no Windows, o npm é um .cmd). */
function npm(pasta: string, ...argumentos: string[]): void {
  const programaDoNpm = process.env.npm_execpath;
  if (!programaDoNpm) throw new Error("Rode pelo npm: npm run pacote.");
  execFileSync(process.execPath, [programaDoNpm, ...argumentos], { cwd: pasta, stdio: "inherit" });
}
