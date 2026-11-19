import fs from "node:fs";
import path from "node:path";
import { executarSftp, lerListagem, type DestinoDoEnvio } from "./sftp.ts";

/*
 * Traz da caixa de saída do servidor do CRM os pedidos que os representantes enviaram (F5, docs/plano.md,
 * "Pedidos: caminho até o ERP"), um arquivo por pedido, para a pasta de recebidos desta máquina. Só a
 * API grava na caixa de saída: daqui ninguém apaga nada lá. O que já foi recebido não vem de novo. O
 * arquivo vem com nome provisório e só ganha o nome do pedido inteiro. O conteúdo é entrada hostil:
 * quem lê os recebidos confere tudo antes de chegar ao Oracle.
 */

const PASTA_NO_SERVIDOR = "/saida";
const PROVISORIO = ".part";
/** Só nomes assim entram nos comandos: um nome estranho vindo do servidor nunca vira comando. */
const NOME_DO_PEDIDO = /^CRM-\d{5,9}\.json$/;
/** Teto por passada: um acúmulo grande vem aos poucos, a cada 5 minutos. */
export const PEDIDOS_POR_PASSADA = 50;

export type ResultadoDaBusca = {
  /** Os pedidos que chegaram nesta passada, em ordem de número. */
  recebidos: string[];
  /** Os novos que ficaram no servidor para a próxima passada, acima do teto. */
  restantes: number;
};

export type PlanoDaBusca = { novos: string[]; comandos: string[]; restantes: number };

export async function buscarPedidosNovos(pastaDosPedidos: string, destino: DestinoDoEnvio): Promise<ResultadoDaBusca> {
  fs.mkdirSync(pastaDosPedidos, { recursive: true });
  const listagem = await executarSftp(destino, [`ls -1 ${PASTA_NO_SERVIDOR}`], pastaDosPedidos);
  const plano = planejarBusca(lerListagem(listagem, NOME_DO_PEDIDO), fs.readdirSync(pastaDosPedidos));
  if (plano.comandos.length > 0) await executarSftp(destino, plano.comandos, pastaDosPedidos);
  for (const nome of plano.novos) fs.renameSync(path.join(pastaDosPedidos, `${nome}${PROVISORIO}`), path.join(pastaDosPedidos, nome));
  return { recebidos: plano.novos, restantes: plano.restantes };
}

/** O que trazer: os pedidos do servidor que ainda não estão aqui, dos mais antigos aos mais novos, até o teto. */
export function planejarBusca(noServidor: readonly string[], jaRecebidos: readonly string[]): PlanoDaBusca {
  const recebidos = new Set(jaRecebidos);
  const pendentes = noServidor.filter((nome) => NOME_DO_PEDIDO.test(nome) && !recebidos.has(nome)).sort(porNumero);
  const novos = pendentes.slice(0, PEDIDOS_POR_PASSADA);
  return {
    novos,
    comandos: novos.map((nome) => `get ${PASTA_NO_SERVIDOR}/${nome} ${nome}${PROVISORIO}`),
    restantes: pendentes.length - novos.length,
  };
}

/** Pelo número, e não pelo texto: CRM-100000 vem depois de CRM-99999. */
function porNumero(a: string, b: string): number {
  return numeroDe(a) - numeroDe(b);
}

function numeroDe(nome: string): number {
  return Number(/\d+/.exec(nome)?.[0] ?? 0);
}
