import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { momentoEmBrasilia } from "dominio/datas";
import { nomeDaFotoDoManifesto } from "dominio/manifestoDaFoto";
import { conferirFoto, FotoRecusada, type FotoConferida, type PastasDaFoto } from "./conferirFoto.ts";

/*
 * A foto em uso. De tempos em tempos o servidor olha se chegou outra na entrada, com manifesto, e
 * passa a usá-la sem parar de responder, depois de copiá-la e conferi-la (docs/plano.md, "Troca da
 * foto"). A foto recusada fica de fora, e a anterior segue valendo.
 */

const INTERVALO_ENTRE_CONFERENCIAS_MS = 30_000;

export type RecusaDaFoto = {
  /** Quando o servidor recusou, em Brasília ("2026-11-05T18:30"). */
  momento: string;
  /** O arquivo da foto que o manifesto descreve. */
  foto: string;
  motivo: string;
};

export type OpcoesDaFotoAtual = {
  agora?: () => number;
  /** Cada foto recusada, para o servidor registrar no app.db. */
  aoRecusar?: (recusa: RecusaDaFoto) => void;
};

export type FotoAtual = {
  /** A foto em uso; lança FotoIndisponivel se ainda não há nenhuma. */
  abrir(): DatabaseSync;
  /** A recusa mais recente desde que a foto em uso entrou, e a de foto mais nova que ela; null se não houve. */
  ultimaRecusa(): RecusaDaFoto | null;
  fechar(): void;
};

export class FotoIndisponivel extends Error {}

export function criarFotoAtual(pastas: PastasDaFoto, { agora = Date.now, aoRecusar = () => {} }: OpcoesDaFotoAtual = {}): FotoAtual {
  let atual: FotoConferida | null = null;
  let ultimaRecusa: RecusaDaFoto | null = null;
  const manifestosVistos = new Set<string>();
  let conferidaEm = Number.NEGATIVE_INFINITY;
  const conferirSeEstaNaHora = () => {
    if (agora() - conferidaEm < INTERVALO_ENTRE_CONFERENCIAS_MS) return;
    conferidaEm = agora();
    const { nova, recusas } = examinarAEntrada(pastas, atual, manifestosVistos, momentoEmBrasilia(new Date(agora())));
    recusas.forEach(aoRecusar);
    if (nova) {
      atual?.db.close();
      atual = nova;
      apagarCopiasAntigas(pastas.conferidas, nova.arquivo);
    }
    // A recusa que fica é a mais nova desta passada; sem nenhuma, a troca apaga a de antes.
    if (nova || recusas.length > 0) ultimaRecusa = recusas[0] ?? null;
  };
  return {
    abrir() {
      conferirSeEstaNaHora();
      if (!atual) throw new FotoIndisponivel(`Nenhuma foto conferida chegou em ${pastas.entrada}. Rode o extrator: npm run foto.`);
      return atual.db;
    },
    ultimaRecusa() {
      conferirSeEstaNaHora();
      return ultimaRecusa;
    },
    fechar() {
      atual?.db.close();
      atual = null;
    },
  };
}

/**
 * Do manifesto mais novo para o mais antigo, a primeira foto que passa na conferência, e as recusas
 * até ela, da mais nova para a mais antiga.
 */
function examinarAEntrada(
  pastas: PastasDaFoto,
  atual: FotoConferida | null,
  vistos: Set<string>,
  momento: string,
): { nova: FotoConferida | null; recusas: RecusaDaFoto[] } {
  const novos = manifestosNaoVistos(pastas.entrada, vistos);
  for (const manifesto of novos) vistos.add(manifesto);
  const recusas: RecusaDaFoto[] = [];
  for (const manifesto of novos) {
    const foto = nomeDaFotoDoManifesto(manifesto) ?? manifesto;
    try {
      const nova = conferirFoto(pastas, manifesto, atual?.geradaEm ?? null);
      console.log(`Foto ${foto} em uso, gerada em ${nova.geradaEm}.`);
      return { nova, recusas };
    } catch (erro) {
      // O erro inesperado também é recusa: a foto em uso precisa continuar.
      const motivo = erro instanceof FotoRecusada ? erro.message : `erro ao conferir (${String(erro)})`;
      console.error(`Foto ${foto} recusada: ${motivo}.`);
      recusas.push({ momento, foto, motivo });
    }
  }
  return { nova: null, recusas };
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
