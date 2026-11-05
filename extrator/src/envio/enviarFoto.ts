import fs from "node:fs";
import { nomeDoManifesto } from "dominio/manifestoDaFoto";
import { ErroNoEnvio, executarSftp, type DestinoDoEnvio } from "./sftp.ts";

/*
 * Leva ao servidor a foto mais nova da pasta, com o manifesto, e deixa lá só as 3 mais novas
 * (docs/plano.md, "Troca da foto"). Cada arquivo vai com nome provisório e ganha o de verdade quando
 * chegou inteiro. O manifesto vai por último: é por ele que o servidor sabe que a foto chegou.
 */

const PASTA_NO_SERVIDOR = "/entrada";
const FOTOS_GUARDADAS_NO_SERVIDOR = 3;
const PROVISORIO = ".part";
/** Só nomes assim entram nos comandos: um nome estranho vindo do servidor nunca vira comando. */
const NOME_NA_ENTRADA = /^(foto-[0-9-]+)\.(db|manifesto\.json)(\.part)?$/;
/** Ao apagar a foto antiga, o manifesto sai antes, para o servidor nunca ver manifesto sem foto. */
const ORDEM_AO_APAGAR = ["manifesto.json", "db"];

export type ResultadoDoEnvio = {
  foto: string;
  /** Falso quando a foto já estava no servidor. */
  isEnviada: boolean;
  fotosApagadas: number;
};

export type PlanoDoEnvio = { comandos: string[]; isEnviada: boolean; fotosApagadas: number };

export async function enviarFotoMaisNova(pastaDasFotos: string, destino: DestinoDoEnvio): Promise<ResultadoDoEnvio> {
  const foto = fotoMaisNovaComManifesto(pastaDasFotos);
  const listagem = await executarSftp(destino, [`ls -1 ${PASTA_NO_SERVIDOR}`], pastaDasFotos);
  const plano = planejarEnvio(foto, lerListagem(listagem));
  if (plano.comandos.length > 0) await executarSftp(destino, plano.comandos, pastaDasFotos);
  return { foto, isEnviada: plano.isEnviada, fotosApagadas: plano.fotosApagadas };
}

/** O que fazer no servidor, a partir do que já está na entrada dele. */
export function planejarEnvio(foto: string, naEntrada: readonly string[]): PlanoDoEnvio {
  const nomes = naEntrada.filter((nome) => NOME_NA_ENTRADA.test(nome));
  const manifesto = nomeDoManifesto(foto);
  const isEnviada = !nomes.includes(manifesto);
  const entregues = isEnviada ? [foto, manifesto] : [];
  const mantidas = fotosMantidas(foto, nomes);
  // Sobra a foto antiga e o nome provisório que um envio interrompido deixou e que esta entrega não reaproveita.
  const isSobra = (nome: string) => !mantidas.has(baseDe(nome)) || (nome.endsWith(PROVISORIO) && !entregues.some((entregue) => nome === `${entregue}${PROVISORIO}`));
  const sobras = nomes.filter(isSobra).sort(porOrdemAoApagar);
  return {
    comandos: [...entregues.flatMap((arquivo) => entregar(arquivo, nomes)), ...sobras.map((nome) => `rm ${noServidor(nome)}`)],
    isEnviada,
    fotosApagadas: sobras.filter((nome) => nome.endsWith(".db")).length,
  };
}

/** O nome provisório e depois o de verdade. Um nome de verdade que sobrou de um envio interrompido sai antes. */
function entregar(arquivo: string, nomes: readonly string[]): string[] {
  const destino = noServidor(arquivo);
  return [...(nomes.includes(arquivo) ? [`rm ${destino}`] : []), `put ${arquivo} ${destino}${PROVISORIO}`, `rename ${destino}${PROVISORIO} ${destino}`];
}

/** As 3 fotos inteiras mais novas do servidor depois da entrega, sempre com a que acabou de chegar. */
function fotosMantidas(foto: string, nomes: readonly string[]): Set<string> {
  const inteiras = [...new Set([...nomes.filter((nome) => nome.endsWith(".db")), foto].map(baseDe))].sort();
  return new Set([...inteiras.slice(-FOTOS_GUARDADAS_NO_SERVIDOR), baseDe(foto)]);
}

function porOrdemAoApagar(a: string, b: string): number {
  return baseDe(a).localeCompare(baseDe(b)) || posicaoAoApagar(a) - posicaoAoApagar(b);
}

function posicaoAoApagar(nome: string): number {
  const tipo = NOME_NA_ENTRADA.exec(nome)?.[2] ?? "";
  return ORDEM_AO_APAGAR.indexOf(tipo);
}

function baseDe(nome: string): string {
  return NOME_NA_ENTRADA.exec(nome)?.[1] ?? nome;
}

function noServidor(nome: string): string {
  return `${PASTA_NO_SERVIDOR}/${nome}`;
}

/** O programa escreve um caminho por linha, depois do eco do comando. */
function lerListagem(saida: string): string[] {
  return saida
    .split(/\r?\n/)
    .map((linha) => linha.trim().split("/").at(-1) ?? "")
    .filter((nome) => NOME_NA_ENTRADA.test(nome));
}

function fotoMaisNovaComManifesto(pasta: string): string {
  const nomes = fs.existsSync(pasta) ? fs.readdirSync(pasta) : [];
  const foto = nomes
    .filter((nome) => NOME_NA_ENTRADA.exec(nome)?.[2] === "db" && !nome.endsWith(PROVISORIO) && nomes.includes(nomeDoManifesto(nome)))
    .sort()
    .at(-1);
  if (!foto) throw new ErroNoEnvio(`Nenhuma foto com manifesto em ${pasta}: rode antes o npm run foto.`);
  return foto;
}
