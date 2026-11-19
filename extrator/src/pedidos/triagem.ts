import fs from "node:fs";
import path from "node:path";
import { dataDoMomento } from "dominio/datas";
import type { Decisao } from "./conferencia.ts";
import { lerPedidoRecebido, type PedidoRecebido } from "./formato.ts";

/*
 * A triagem dos pedidos que vieram do CRM (F5), na pasta de pedidos da máquina do extrator:
 * - recebidos/: tudo o que veio da caixa de saída do servidor, como veio. Não muda; é por ela que a
 *   busca sabe o que já trouxe;
 * - conferidos/: passou em tudo e pode ir ao SGI, com o que só a LAN sabe ao lado (<número>.erp.json);
 * - revisao/: passou, mas está acima do valor-teto e espera alguém da Suprens;
 * - aguardando/: espera vendas cadastrar a transportadora nova; é conferido de novo a cada passada;
 * - quarentena/: recusado, com o motivo em <número>.motivo.txt.
 * O arquivo PAUSAR na pasta de pedidos suspende a triagem (e, depois, a gravação no SGI) até ser apagado.
 */

export type Destino = Decisao["destino"];
export type ResumoDaTriagem = { isPausada: boolean; porDestino: Record<Destino, string[]> };
export type Conferir = (pedido: PedidoRecebido) => Promise<Decisao>;

/** Pedidos aceitos por login num dia: um teto contra abuso de uma sessão roubada. Provisório, a confirmar com o Lucas. */
export const PEDIDOS_POR_LOGIN_POR_DIA = 30;
export const ARQUIVO_PARA_PAUSAR = "PAUSAR";

/** A pasta dos recebidos, dentro da pasta de pedidos: onde a busca (envio/buscarPedidos.ts) deixa o que trouxe. */
export const RECEBIDOS = "recebidos";
/** Os que já tiveram destino final: não são conferidos de novo. */
const DECIDIDOS: readonly Destino[] = ["conferidos", "revisao", "quarentena"];
const NOME_DO_PEDIDO = /^CRM-\d{5,9}\.json$/;

export function isPausada(pastaDosPedidos: string): boolean {
  return fs.existsSync(path.join(pastaDosPedidos, ARQUIVO_PARA_PAUSAR));
}

/** Os recebidos ainda sem destino final, em ordem de número: os novos e os que aguardam a transportadora. */
export function pedidosParaTriar(pastaDosPedidos: string): string[] {
  const decididos = new Set(DECIDIDOS.flatMap((destino) => pedidosEm(pastaDosPedidos, destino)));
  return pedidosEm(pastaDosPedidos, RECEBIDOS)
    .filter((nome) => !decididos.has(nome))
    .sort((a, b) => numeroDe(a) - numeroDe(b));
}

export async function triarRecebidos(pastaDosPedidos: string, conferir: Conferir): Promise<ResumoDaTriagem> {
  const porDestino: Record<Destino, string[]> = { conferidos: [], revisao: [], aguardando: [], quarentena: [] };
  if (isPausada(pastaDosPedidos)) return { isPausada: true, porDestino };
  const aceitosPorLoginNoDia = contarAceitos(pastaDosPedidos);
  for (const nome of pedidosParaTriar(pastaDosPedidos)) {
    const conteudo = fs.readFileSync(path.join(pastaDosPedidos, RECEBIDOS, nome), "utf8");
    const decisao = await decidirPedido(conteudo, nome, aceitosPorLoginNoDia, conferir);
    guardar(pastaDosPedidos, nome, conteudo, decisao);
    porDestino[decisao.destino].push(nome.replace(".json", ""));
  }
  return { isPausada: false, porDestino };
}

async function decidirPedido(conteudo: string, nome: string, aceitos: Map<string, number>, conferir: Conferir): Promise<Decisao> {
  const leitura = lerPedidoRecebido(conteudo, nome);
  if (!leitura.ok) return { destino: "quarentena", motivo: leitura.motivo };
  const chave = chaveDoLoginNoDia(leitura.pedido);
  if ((aceitos.get(chave) ?? 0) >= PEDIDOS_POR_LOGIN_POR_DIA) {
    return { destino: "quarentena", motivo: `o login já tem ${PEDIDOS_POR_LOGIN_POR_DIA} pedidos aceitos no dia do envio` };
  }
  const decisao = await conferir(leitura.pedido);
  if (decisao.destino === "conferidos" || decisao.destino === "revisao") aceitos.set(chave, (aceitos.get(chave) ?? 0) + 1);
  return decisao;
}

/** O pedido no destino, como veio, e ao lado o que a decisão acrescenta. O que aguardava sai de lá. */
function guardar(pastaDosPedidos: string, nome: string, conteudo: string, decisao: Decisao): void {
  const pasta = path.join(pastaDosPedidos, decisao.destino);
  const base = nome.replace(".json", "");
  fs.mkdirSync(pasta, { recursive: true });
  if ("erp" in decisao) gravarInteiro(path.join(pasta, `${base}.erp.json`), JSON.stringify(decisao.erp));
  if ("motivo" in decisao) gravarInteiro(path.join(pasta, `${base}.motivo.txt`), `${decisao.motivo}\n`);
  // O pedido por último: quem lê o destino só vê o pedido com o que vem ao lado já gravado.
  gravarInteiro(path.join(pasta, nome), conteudo);
  if (decisao.destino !== "aguardando") {
    for (const sobra of [nome, `${base}.motivo.txt`]) fs.rmSync(path.join(pastaDosPedidos, "aguardando", sobra), { force: true });
  }
}

function gravarInteiro(arquivo: string, conteudo: string): void {
  fs.writeFileSync(`${arquivo}.part`, conteudo);
  fs.renameSync(`${arquivo}.part`, arquivo);
}

/** Os pedidos já aceitos (conferidos e em revisão) de cada login, por dia do envio. */
function contarAceitos(pastaDosPedidos: string): Map<string, number> {
  const contagem = new Map<string, number>();
  for (const destino of ["conferidos", "revisao"] as const) {
    for (const nome of pedidosEm(pastaDosPedidos, destino)) {
      const leitura = lerPedidoRecebido(fs.readFileSync(path.join(pastaDosPedidos, destino, nome), "utf8"), nome);
      if (!leitura.ok) continue;
      const chave = chaveDoLoginNoDia(leitura.pedido);
      contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
    }
  }
  return contagem;
}

function chaveDoLoginNoDia({ usuario, enviadoEm }: PedidoRecebido): string {
  return `${usuario}/${dataDoMomento(enviadoEm)}`;
}

function pedidosEm(pastaDosPedidos: string, pasta: string): string[] {
  const caminho = path.join(pastaDosPedidos, pasta);
  return fs.existsSync(caminho) ? fs.readdirSync(caminho).filter((nome) => NOME_DO_PEDIDO.test(nome)) : [];
}

function numeroDe(nome: string): number {
  return Number(/\d+/.exec(nome)?.[0] ?? 0);
}
