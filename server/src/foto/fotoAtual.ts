import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { VERSAO_DO_ESQUEMA } from "dominio/esquemaDaFoto";

/*
 * A foto mais nova da pasta, aberta só para leitura. De tempos em tempos o servidor confere se
 * chegou outra e passa a usá-la sem parar de responder (docs/plano.md, "Troca da foto").
 */

const INTERVALO_ENTRE_CONFERENCIAS_MS = 30_000;

export type FotoAtual = {
  /** A foto em uso; lança FotoIndisponivel se ainda não há nenhuma. */
  abrir(): DatabaseSync;
  fechar(): void;
};

export class FotoIndisponivel extends Error {}

type FotoAberta = { arquivo: string; db: DatabaseSync };

export function criarFotoAtual(pasta: string, agora: () => number = Date.now): FotoAtual {
  let atual: FotoAberta | null = null;
  let conferidaEm = Number.NEGATIVE_INFINITY;
  return {
    abrir() {
      if (agora() - conferidaEm >= INTERVALO_ENTRE_CONFERENCIAS_MS) {
        conferidaEm = agora();
        atual = trocarSeChegouOutra(pasta, atual);
      }
      if (!atual) throw new FotoIndisponivel(`Nenhuma foto em ${pasta}. Rode o extrator: npm run foto.`);
      return atual.db;
    },
    fechar() {
      atual?.db.close();
      atual = null;
    },
  };
}

function trocarSeChegouOutra(pasta: string, atual: FotoAberta | null): FotoAberta | null {
  const maisNova = fotoMaisNova(pasta);
  if (!maisNova || maisNova === atual?.arquivo) return atual;
  const db = new DatabaseSync(path.join(pasta, maisNova), { readOnly: true });
  const versao = db.prepare("SELECT versao_esquema FROM foto").get()?.versao_esquema;
  if (versao !== VERSAO_DO_ESQUEMA) {
    db.close();
    console.error(`Foto ${maisNova} recusada: esquema ${String(versao)}, o servidor lê o ${VERSAO_DO_ESQUEMA}.`);
    return atual;
  }
  atual?.db.close();
  return { arquivo: maisNova, db };
}

/** O nome da foto começa pela hora em que foi gerada: a última em ordem é a mais nova. */
function fotoMaisNova(pasta: string): string | null {
  if (!fs.existsSync(pasta)) return null;
  return (
    fs
      .readdirSync(pasta)
      .filter((nome) => nome.startsWith("foto-") && nome.endsWith(".db"))
      .sort()
      .at(-1) ?? null
  );
}
