import fs from "node:fs";
import path from "node:path";
import { momentoEmBrasilia } from "dominio/datas";
import { lerSituacaoNoSgi } from "../erp/dadosDaGravacao.ts";
import type { Oracle } from "../oracle.ts";
import type { PedidoNoErp } from "./conferencia.ts";
import { GRAVADOS, lerRegistroDaGravacao } from "./gravacao.ts";
import { RECEBIDOS } from "./triagem.ts";

/*
 * O andamento dos pedidos do CRM, para a foto (F5, etapa 5): o que a máquina do extrator sabe de cada
 * pedido que recebeu, e, dos gravados, o status e o total no SGI. A foto leva isso pelo número do CRM, e
 * o servidor mostra a cada login o dele. O pedido sai da foto 180 dias depois de recebido.
 */

export type PedidoDoCrmNaLan =
  | { numero: string; recebidoEm: string; situacao: "recebido" }
  | { numero: string; recebidoEm: string; situacao: "recusado"; motivo: string; recusadoEm: string }
  | {
      numero: string;
      recebidoEm: string;
      situacao: "gravado";
      numeroSgi: number;
      gravadoEm: string;
      /** PV1_STA no SGI; null se o pedido não foi achado lá. */
      statusNoSgi: string | null;
      totalNoSgi: number | null;
    };

export type PedidoNaLan = Exclude<PedidoDoCrmNaLan, { situacao: "gravado" }> | { numero: string; recebidoEm: string; situacao: "gravado"; numeroSgi: number; cliente: number; gravadoEm: string };

const DIAS_NA_FOTO = 180;
const UM_DIA_MS = 24 * 60 * 60_000;
const NOME_DO_PEDIDO = /^CRM-\d{5,9}\.json$/;
/** O motivo que vem da gravação é técnico (o erro do Oracle): o representante vê um aviso só. */
const RECUSA_NA_GRAVACAO = "na gravação no SGI:";
const AVISO_DA_RECUSA_NA_GRAVACAO = "O SGI não aceitou o pedido. A Suprens vai verificar e entrar em contato.";

export async function lerAndamentoDosPedidosDoCrm(oracle: Oracle, pastaDosPedidos: string, agora = Date.now()): Promise<PedidoDoCrmNaLan[]> {
  const naLan = lerPedidosNaLan(pastaDosPedidos, agora);
  const gravados = naLan.flatMap((pedido) => (pedido.situacao === "gravado" ? [pedido] : []));
  const situacoes = await lerSituacaoNoSgi(oracle, gravados.map(({ numeroSgi, cliente }) => ({ numeroSgi, cliente })));
  return naLan.map((pedido) => {
    if (pedido.situacao !== "gravado") return pedido;
    const { cliente: _cliente, ...semCliente } = pedido;
    const situacao = situacoes.get(pedido.numeroSgi);
    return { ...semCliente, statusNoSgi: situacao?.status ?? null, totalNoSgi: situacao?.total ?? null };
  });
}

/** O que as pastas de pedidos dizem de cada pedido recebido nos últimos 180 dias, sem o Oracle. */
export function lerPedidosNaLan(pastaDosPedidos: string, agora: number): PedidoNaLan[] {
  const recebidos = path.join(pastaDosPedidos, RECEBIDOS);
  if (!fs.existsSync(recebidos)) return [];
  return fs
    .readdirSync(recebidos)
    .filter((nome) => NOME_DO_PEDIDO.test(nome))
    .flatMap((nome) => {
      const recebidoEmMs = fs.statSync(path.join(recebidos, nome)).mtimeMs;
      return agora - recebidoEmMs > DIAS_NA_FOTO * UM_DIA_MS ? [] : [situacaoNaLan(pastaDosPedidos, nome, momentoEmBrasilia(new Date(recebidoEmMs)))];
    });
}

function situacaoNaLan(pastaDosPedidos: string, nome: string, recebidoEm: string): PedidoNaLan {
  const numero = nome.replace(".json", "");
  const gravado = lerRegistroDaGravacao(pastaDosPedidos, numero);
  if (gravado) {
    const { cliente } = JSON.parse(fs.readFileSync(path.join(pastaDosPedidos, GRAVADOS, `${numero}.erp.json`), "utf8")) as PedidoNoErp;
    return { numero, recebidoEm, situacao: "gravado", numeroSgi: gravado.numeroNoSgi, cliente, gravadoEm: momentoEmBrasilia(new Date(gravado.gravadoEm)) };
  }
  const motivo = path.join(pastaDosPedidos, "quarentena", `${numero}.motivo.txt`);
  if (fs.existsSync(motivo)) {
    const texto = fs.readFileSync(motivo, "utf8").trim();
    return {
      numero,
      recebidoEm,
      situacao: "recusado",
      motivo: texto.startsWith(RECUSA_NA_GRAVACAO) ? AVISO_DA_RECUSA_NA_GRAVACAO : texto,
      recusadoEm: momentoEmBrasilia(new Date(fs.statSync(motivo).mtimeMs)),
    };
  }
  return { numero, recebidoEm, situacao: "recebido" };
}
