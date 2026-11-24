import type { Foto } from "dominio/esquemaDaFoto";
import type { CondicoesNoSgi, PedidosNoSgi, ReferenciasDoItemNoSgi } from "../erp/tipos.ts";
import { CLASSIFICACOES } from "./dadosDoPedido.ts";

/*
 * O que o representante preencheu nos pedidos do Omega que a foto mostra, como o pedido enviado pelo
 * CRM mostra (pedido do Lucas em 2026-11-24): o cabeçalho e as referências do cliente em cada item,
 * do pedido do SGI com o mesmo número. Só vale o do mesmo cliente: o número do SGI recomeça depois de
 * 2.999.999.
 */

export type TabelasDasCondicoes = Pick<Foto, "pedido_condicoes" | "pedido_item_referencia">;

/** Um pedido que a foto mostra: o número e a chave do cliente no ERP ("empresa/cliente"). */
export type PedidoDaFoto = { pedido: string; chave: string };

const TIPOS_DE_ENTREGA: Readonly<Record<string, string>> = { IMEDIATA: "imediata", PROGRAMADA: "programada" };

/** As letras do campo "Frete" do app antigo dos representantes (untPedidos_Mov.dfm, cbFrete). */
const PAGAMENTOS_DO_FRETE: ReadonlySet<string> = new Set(["T", "C", "F", "P", "I", "N", "S"]);

export function montarCondicoesDosPedidos(noSgi: PedidosNoSgi, pedidosDaFoto: readonly PedidoDaFoto[]): TabelasDasCondicoes {
  const clientePorPedido = new Map(pedidosDaFoto.map(({ pedido, chave }) => [pedido, clienteDaChave(chave)]));
  const condicoes = noSgi.condicoes.filter((condicao) => clientePorPedido.get(condicao.pedido) === String(condicao.cliente));
  const ligados = new Set(condicoes.map(({ pedido }) => pedido));
  return {
    pedido_condicoes: condicoes.map(linhaDasCondicoes),
    pedido_item_referencia: referenciasPorProduto(noSgi.itens.filter((item) => ligados.has(item.pedido))),
  };
}

function linhaDasCondicoes(condicao: CondicoesNoSgi): TabelasDasCondicoes["pedido_condicoes"][number] {
  return {
    pedido: condicao.pedido,
    transportadora: condicao.transportadora,
    condicao_pagamento: condicao.condicaoDePagamento,
    tipo_entrega: TIPOS_DE_ENTREGA[maiusculas(condicao.tipoDeEntrega)] ?? null,
    entrega: condicao.entrega,
    ordem_de_compra: textoDoCliente(condicao.ordemDeCompra),
    classificacao: CLASSIFICACOES[maiusculas(condicao.classificacao)] ?? null,
    aceita_parcial: aceitaParcial(condicao.freteParcial),
    pagamento_frete: pagamentoDoFrete(condicao.pagamentoDoFrete),
    observacao: condicao.observacao?.trim() || null,
  };
}

/** O mesmo produto em mais de uma linha do pedido fica com as referências da primeira que tem alguma. */
function referenciasPorProduto(itens: readonly ReferenciasDoItemNoSgi[]): TabelasDasCondicoes["pedido_item_referencia"] {
  const porProduto = new Map<string, TabelasDasCondicoes["pedido_item_referencia"][number]>();
  for (const item of itens) {
    const linha = {
      pedido: item.pedido,
      produto: item.produto,
      part_number: textoDoCliente(item.partNumber),
      ordem_de_compra: textoDoCliente(item.ordemDeCompra),
      item_da_ordem_de_compra: item.itemDaOrdemDeCompra,
    };
    const chave = `${item.pedido}\u0000${item.produto}`;
    const temAlguma = linha.part_number !== null || linha.ordem_de_compra !== null || linha.item_da_ordem_de_compra !== null;
    if (temAlguma && !porProduto.has(chave)) porProduto.set(chave, linha);
  }
  return [...porProduto.values()];
}

function clienteDaChave(chave: string): string {
  return chave.slice(chave.indexOf("/") + 1);
}

function maiusculas(texto: string | null): string {
  return texto?.trim().toUpperCase() ?? "";
}

/** O texto que o cliente passou: vazio e "0" são o "sem" do SGI. */
function textoDoCliente(texto: string | null): string | null {
  const limpo = texto?.trim() ?? "";
  return limpo === "" || limpo === "0" ? null : limpo;
}

/** "ACEITA FRETE PARCIAL" ou "NAO ACEITA FRETE PARCIAL" (também sem o "FRETE PARCIAL"). */
function aceitaParcial(texto: string | null): number | null {
  const valor = maiusculas(texto);
  if (valor.startsWith("NAO")) return 0;
  return valor.startsWith("ACEITA") ? 1 : null;
}

function pagamentoDoFrete(texto: string | null): string | null {
  const letra = maiusculas(texto).slice(0, 1);
  return PAGAMENTOS_DO_FRETE.has(letra) ? letra : null;
}
