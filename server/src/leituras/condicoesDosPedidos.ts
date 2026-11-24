import type { DatabaseSync } from "node:sqlite";
import type { OrdemDeCompraDoItem, PartNumberDoItem } from "dominio/pedido";
import type { Classificacao, CondicoesDoPedidoNoErp, PagamentoDoFrete } from "../../../web/src/dados/tipos.ts";
import { COLUNAS_DA_TRANSPORTADORA, transportadoraDaLinha } from "./dadosDoPedido.ts";
import { lerLinhas, numero, texto, textoOuNulo, type Linha } from "./linhas.ts";

/*
 * O que o representante preencheu nos pedidos do ERP feitos fora do CRM (foto: pedido_condicoes e
 * pedido_item_referencia, versão 25). Quem chama passa só pedidos que já conferiu serem do login: esta
 * leitura não tem escopo próprio.
 */

export type ReferenciasDoItem = OrdemDeCompraDoItem & PartNumberDoItem;

export const SEM_REFERENCIAS: ReferenciasDoItem = { ordemDeCompra: null, itemDaOrdemDeCompra: null, partNumber: null };

export type CondicoesDosPedidos = {
  condicoes: ReadonlyMap<string, CondicoesDoPedidoNoErp>;
  /** Pedido → produto → referências. */
  referencias: ReadonlyMap<string, ReadonlyMap<string, ReferenciasDoItem>>;
};

export function lerCondicoesDosPedidos(db: DatabaseSync, pedidos: readonly string[]): CondicoesDosPedidos {
  const lista = JSON.stringify([...new Set(pedidos)]);
  const referencias = lerReferencias(db, lista);
  const linhas = lerLinhas(
    db,
    `SELECT x.*, c.descricao AS descricao_da_condicao
       FROM pedido_condicoes x LEFT JOIN condicao_pagamento c ON c.codigo = x.condicao_pagamento
      WHERE x.pedido IN (SELECT value FROM json_each(?))`,
    [lista],
  );
  const transportadoras = lerTransportadoras(db, linhas);
  const condicoes = new Map(
    linhas.map((linha) => {
      const pedido = texto(linha, "pedido");
      const comItem = [...(referencias.get(pedido)?.values() ?? [])].some(({ itemDaOrdemDeCompra }) => itemDaOrdemDeCompra !== null);
      return [pedido, condicoesDaLinha(linha, transportadoras, comItem)];
    }),
  );
  return { condicoes, referencias };
}

/** As referências do produto no primeiro dos pedidos que as tem: a nota pode sair de mais de um. */
export function referenciasDoProduto(referencias: CondicoesDosPedidos["referencias"], pedidos: readonly string[], produto: string): ReferenciasDoItem {
  for (const pedido of pedidos) {
    const doProduto = referencias.get(pedido)?.get(produto);
    if (doProduto) return doProduto;
  }
  return SEM_REFERENCIAS;
}

function condicoesDaLinha(linha: Linha, transportadoras: ReadonlyMap<string, CondicoesDoPedidoNoErp["transportadora"]>, temItemDaOrdemDeCompra: boolean): CondicoesDoPedidoNoErp {
  const codigoDaTransportadora = textoOuNulo(linha, "transportadora");
  const aceitaParcial = linha.aceita_parcial;
  return {
    numero: texto(linha, "pedido"),
    transportadora: codigoDaTransportadora === null ? null : (transportadoras.get(codigoDaTransportadora) ?? null),
    condicaoDePagamento: textoOuNulo(linha, "descricao_da_condicao") ?? textoOuNulo(linha, "condicao_pagamento"),
    tipoDeEntrega: textoOuNulo(linha, "tipo_entrega") as CondicoesDoPedidoNoErp["tipoDeEntrega"],
    entrega: textoOuNulo(linha, "entrega"),
    ordemDeCompra: textoOuNulo(linha, "ordem_de_compra"),
    classificacao: textoOuNulo(linha, "classificacao") as Classificacao | null,
    aceitaParcial: aceitaParcial === null ? null : Number(aceitaParcial) === 1,
    pagamentoDoFrete: textoOuNulo(linha, "pagamento_frete") as PagamentoDoFrete | null,
    observacao: textoOuNulo(linha, "observacao"),
    temItemDaOrdemDeCompra,
  };
}

function lerTransportadoras(db: DatabaseSync, condicoes: readonly Linha[]): Map<string, CondicoesDoPedidoNoErp["transportadora"]> {
  const codigos = JSON.stringify([...new Set(condicoes.flatMap((linha) => textoOuNulo(linha, "transportadora") ?? []))]);
  const linhas = lerLinhas(db, `SELECT ${COLUNAS_DA_TRANSPORTADORA} FROM transportadora WHERE codigo IN (SELECT value FROM json_each(?))`, [codigos]);
  return new Map(linhas.map((linha) => [texto(linha, "codigo"), transportadoraDaLinha(linha)]));
}

function lerReferencias(db: DatabaseSync, lista: string): Map<string, Map<string, ReferenciasDoItem>> {
  const porPedido = new Map<string, Map<string, ReferenciasDoItem>>();
  const linhas = lerLinhas(db, "SELECT * FROM pedido_item_referencia WHERE pedido IN (SELECT value FROM json_each(?))", [lista]);
  for (const linha of linhas) {
    const pedido = texto(linha, "pedido");
    const doPedido = porPedido.get(pedido) ?? new Map<string, ReferenciasDoItem>();
    doPedido.set(texto(linha, "produto"), {
      partNumber: textoOuNulo(linha, "part_number"),
      ordemDeCompra: textoOuNulo(linha, "ordem_de_compra"),
      itemDaOrdemDeCompra: linha.item_da_ordem_de_compra === null ? null : numero(linha, "item_da_ordem_de_compra"),
    });
    porPedido.set(pedido, doPedido);
  }
  return porPedido;
}
