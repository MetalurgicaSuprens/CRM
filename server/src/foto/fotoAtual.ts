import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { nomeDaFotoDoManifesto } from "dominio/manifestoDaFoto";
import { conferirFoto, FotoRecusada, type FotoConferida, type PastasDaFoto } from "./conferirFoto.ts";

/*
 * A foto em uso. De tempos em tempos o servidor olha se chegou outra na entrada, com manifesto, e
 * passa a usá-la sem parar de responder, depois de copiá-la e conferi-la (docs/plano.md, "Troca da
 * foto"). A foto recusada fica de fora, e a anterior segue valendo.
 */

const INTERVALO_ENTRE_CONFERENCIAS_MS = 30_000;

export type FotoAtual = {
  /** A foto em uso; lança FotoIndisponivel se ainda não há nenhuma. */
  abrir(): DatabaseSync;
  fechar(): void;
};

export class FotoIndisponivel extends Error {}

export function criarFotoAtual(pastas: PastasDaFoto, agora: () => number = Date.now): FotoAtual {
  let atual: FotoConferida | null = null;
  const manifestosVistos = new Set<string>();
  let conferidaEm = Number.NEGATIVE_INFINITY;
  return {
    abrir() {
      if (agora() - conferidaEm >= INTERVALO_ENTRE_CONFERENCIAS_MS) {
        conferidaEm = agora();
        atual = trocarSeChegouOutra(pastas, atual, manifestosVistos);
      }
      if (!atual) throw new FotoIndisponivel(`Nenhuma foto conferida chegou em ${pastas.entrada}. Rode o extrator: npm run foto.`);
      return atual.db;
    },
    fechar() {
      atual?.db.close();
      atual = null;
    },
  };
}

/** Do manifesto mais novo para o mais antigo, a primeira foto que passa na conferência. */
function trocarSeChegouOutra(pastas: PastasDaFoto, atual: FotoConferida | null, vistos: Set<string>): FotoConferida | null {
  const novos = manifestosNaoVistos(pastas.entrada, vistos);
  for (const manifesto of novos) vistos.add(manifesto);
  for (const manifesto of novos) {
    const nova = conferirOuExplicar(pastas, manifesto, atual);
    if (!nova) continue;
    atual?.db.close();
    apagarCopiasAntigas(pastas.conferidas, nova.arquivo);
    console.log(`Foto ${nomeDaFotoDoManifesto(manifesto)} em uso, gerada em ${nova.geradaEm}.`);
    return nova;
  }
  return atual;
}

/** A recusa vai para o log; o erro inesperado também, porque a foto em uso precisa continuar. */
function conferirOuExplicar(pastas: PastasDaFoto, manifesto: string, atual: FotoConferida | null): FotoConferida | null {
  try {
    return conferirFoto(pastas, manifesto, atual?.geradaEm ?? null);
  } catch (erro) {
    const motivo = erro instanceof FotoRecusada ? erro.message : `erro ao conferir (${String(erro)})`;
    console.error(`Foto do manifesto ${manifesto} recusada: ${motivo}.`);
    return null;
  }
}

function manifestosNaoVistos(entrada: string, vistos: ReadonlySet<string>): string[] {
  if (!fs.existsSync(entrada)) return [];
  return fs
    .readdirSync(entrada)
    .filter((nome) => nomeDaFotoDoManifesto(nome) !== null && !vistos.has(nome))
    .sort()
    .reverse();
}

/** Fica só a cópia em uso. A que outro processo ainda tem aberta sai numa próxima troca. */
function apagarCopiasAntigas(pasta: string, emUso: string): void {
  for (const nome of fs.readdirSync(pasta)) {
    const arquivo = path.join(pasta, nome);
    if (arquivo === emUso) continue;
    try {
      fs.rmSync(arquivo);
    } catch {
      // Aberta por outro processo: sai na próxima troca.
    }
  }
}
