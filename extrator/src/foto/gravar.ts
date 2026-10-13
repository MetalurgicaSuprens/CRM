import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { ESQUEMA, type Foto } from "dominio/esquemaDaFoto";

/*
 * Grava a foto num arquivo novo: primeiro como .part, e só no fim com o nome de verdade. Assim
 * quem lê nunca pega uma foto pela metade, e a foto anterior segue valendo até lá.
 */

const FOTOS_GUARDADAS = 3;
const PREFIXO = "foto-";

/** Devolve o caminho da foto gravada, cujo nome ordena da mais antiga para a mais nova. */
export function gravarFoto(foto: Foto, pasta: string): string {
  fs.mkdirSync(pasta, { recursive: true });
  const nome = `${PREFIXO}${foto.foto.gerada_em.replace(/[-:]/g, "").replace("T", "-")}-${Date.now()}.db`;
  const destino = path.join(pasta, nome);
  const temporario = `${destino}.part`;
  const db = new DatabaseSync(temporario);
  try {
    db.exec("PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;");
    db.exec(ESQUEMA);
    db.exec("BEGIN");
    for (const [tabela, conteudo] of Object.entries(foto)) inserir(db, tabela, Array.isArray(conteudo) ? conteudo : [conteudo]);
    db.exec("COMMIT");
    conferirIntegridade(db);
  } finally {
    db.close();
  }
  fs.renameSync(temporario, destino);
  apagarFotosAntigas(pasta);
  return destino;
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

/** Fica com as 3 mais novas. A que o servidor ainda tem aberta fica para a próxima vez. */
function apagarFotosAntigas(pasta: string): void {
  const fotos = fs.readdirSync(pasta).filter((nome) => nome.startsWith(PREFIXO) && nome.endsWith(".db")).sort();
  for (const nome of fotos.slice(0, -FOTOS_GUARDADAS)) {
    try {
      fs.rmSync(path.join(pasta, nome));
    } catch {
      // Arquivo em uso: sai na próxima foto.
    }
  }
}
