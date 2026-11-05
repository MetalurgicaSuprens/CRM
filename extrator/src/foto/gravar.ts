import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { ESQUEMA, type Foto } from "dominio/esquemaDaFoto";
import { nomeDoManifesto, type ManifestoDaFoto } from "dominio/manifestoDaFoto";
import { motivoParaNaoComparar, problemasDaFotoNova } from "./comparacao.ts";
import { resumirFoto, type ResumoDaFoto } from "./resumo.ts";

/*
 * Grava a foto num arquivo novo: primeiro como .part, e só no fim com o nome de verdade. Assim
 * quem lê nunca pega uma foto pela metade, e a foto anterior segue valendo até lá. Antes do nome de
 * verdade, a foto nova é comparada com a anterior; depois dele, vem o manifesto, por último, que é o
 * que o servidor procura (docs/plano.md, "Troca da foto").
 */

const FOTOS_GUARDADAS = 3;
const PREFIXO = "foto-";

export type OpcoesDaGravacao = {
  /** Grava sem comparar com a foto anterior, quando a mudança grande é esperada. */
  aceitarMudanca: boolean;
};

export type FotoGravada = {
  arquivo: string;
  /** Por que a foto não foi comparada com a anterior; null se foi. */
  semComparar: string | null;
};

/** A foto nova mudou demais desde a anterior: não foi gravada, e a anterior segue valendo. */
export class FotoRecusada extends Error {}

/** O nome da foto gravada ordena da mais antiga para a mais nova. */
export function gravarFoto(foto: Foto, pasta: string, { aceitarMudanca }: OpcoesDaGravacao): FotoGravada {
  fs.mkdirSync(pasta, { recursive: true });
  const anterior = fotoMaisNova(pasta);
  const destino = path.join(pasta, `${PREFIXO}${foto.foto.gerada_em.replace(/[-:]/g, "").replace("T", "-")}-${Date.now()}.db`);
  const temporario = `${destino}.part`;
  const resumo = escreverBanco(foto, temporario);
  const { recusa, semComparar } = aceitarMudanca
    ? { recusa: null, semComparar: "pedido com --aceitar-mudanca" }
    : conferirContraAAnterior(resumo, anterior);
  if (recusa) {
    fs.rmSync(temporario);
    throw new FotoRecusada(recusa);
  }
  fs.renameSync(temporario, destino);
  escreverManifesto(destino, resumo);
  apagarFotosAntigas(pasta);
  return { arquivo: destino, semComparar };
}

function escreverBanco(foto: Foto, arquivo: string): ResumoDaFoto {
  const db = new DatabaseSync(arquivo);
  try {
    db.exec("PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;");
    db.exec(ESQUEMA);
    db.exec("BEGIN");
    for (const [tabela, conteudo] of Object.entries(foto)) inserir(db, tabela, Array.isArray(conteudo) ? conteudo : [conteudo]);
    db.exec("COMMIT");
    conferirIntegridade(db);
    return resumirFoto(db);
  } finally {
    db.close();
  }
}

/** A tabela e as colunas vêm do tipo Foto, nunca de fora; os valores vão por parâmetro. */
function inserir(db: DatabaseSync, tabela: string, linhas: readonly object[]): void {
  const [primeira] = linhas;
  if (!primeira) return;
  const colunas = Object.keys(primeira);
  const comando = db.prepare(`INSERT INTO ${tabela} (${colunas.join(", ")}) VALUES (${colunas.map(() => "?").join(", ")})`);
  for (const linha of linhas) {
    const valores = linha as Record<string, SQLInputValue | undefined>;
    comando.run(...colunas.map((coluna) => valores[coluna] ?? null));
  }
}

function conferirIntegridade(db: DatabaseSync): void {
  const [resultado] = db.prepare("PRAGMA integrity_check").all();
  if (resultado?.integrity_check !== "ok") throw new Error("A foto gravada não passou no integrity_check.");
}

type Conferencia = {
  /** A explicação para quem rodou o extrator; null se a foto nova pode seguir. */
  recusa: string | null;
  semComparar: string | null;
};

function conferirContraAAnterior(nova: ResumoDaFoto, anterior: string | null): Conferencia {
  if (!anterior) return { recusa: null, semComparar: "é a primeira foto da pasta" };
  const resumoAnterior = resumirArquivo(anterior);
  const motivo = motivoParaNaoComparar(nova, resumoAnterior);
  if (motivo) return { recusa: null, semComparar: motivo };
  const problemas = problemasDaFotoNova(nova, resumoAnterior);
  return { recusa: problemas.length > 0 ? explicarARecusa(problemas, anterior) : null, semComparar: null };
}

function resumirArquivo(arquivo: string): ResumoDaFoto {
  const db = new DatabaseSync(arquivo, { readOnly: true });
  try {
    return resumirFoto(db);
  } finally {
    db.close();
  }
}

function explicarARecusa(problemas: readonly string[], anterior: string): string {
  return [
    `A foto nova não foi gravada: ela mudou demais desde a anterior (${path.basename(anterior)}).`,
    ...problemas.map((problema) => `  - ${problema}`),
    "Se a mudança é esperada, rode de novo com --aceitar-mudanca (npm run foto -- --aceitar-mudanca).",
  ].join("\n");
}

/** Gravado por último e com troca de nome: quando o manifesto aparece, a foto já está inteira. */
function escreverManifesto(arquivoDaFoto: string, resumo: ResumoDaFoto): void {
  const conteudo = fs.readFileSync(arquivoDaFoto);
  const manifesto: ManifestoDaFoto = {
    versaoDoEsquema: resumo.versaoDoEsquema,
    geradaEm: resumo.geradaEm,
    tamanho: conteudo.length,
    sha256: crypto.createHash("sha256").update(conteudo).digest("hex"),
    contagens: resumo.linhas,
  };
  const destino = path.join(path.dirname(arquivoDaFoto), nomeDoManifesto(path.basename(arquivoDaFoto)));
  fs.writeFileSync(`${destino}.part`, JSON.stringify(manifesto, null, 2));
  fs.renameSync(`${destino}.part`, destino);
}

function fotoMaisNova(pasta: string): string | null {
  const nome = nomesDasFotos(pasta).at(-1);
  return nome === undefined ? null : path.join(pasta, nome);
}

function nomesDasFotos(pasta: string): string[] {
  return fs
    .readdirSync(pasta)
    .filter((nome) => nome.startsWith(PREFIXO) && nome.endsWith(".db"))
    .sort();
}

/** Fica com as 3 mais novas. O manifesto sai antes, para o servidor nunca ver manifesto sem foto. */
function apagarFotosAntigas(pasta: string): void {
  for (const nome of nomesDasFotos(pasta).slice(0, -FOTOS_GUARDADAS)) {
    apagarSePuder(path.join(pasta, nomeDoManifesto(nome)));
    apagarSePuder(path.join(pasta, nome));
  }
}

function apagarSePuder(arquivo: string): void {
  try {
    fs.rmSync(arquivo, { force: true });
  } catch {
    // Arquivo em uso: sai na próxima foto.
  }
}
