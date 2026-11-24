import type { ReactNode } from "react";
import type { OrdemDeCompraDoItem, PartNumberDoItem } from "dominio/pedido";
import type { CondicoesParaMostrar } from "../dados/dadosDoPedido";
import { DetalheDoFato, Fato } from "./Fato";
import type { ColunaDaTabela } from "./TabelaResponsiva";
import estilos from "./CondicoesDoPedido.module.css";

/*
 * O que o representante preencheu no pedido, igual no enviado pelo CRM e no do ERP feito fora dele
 * (pedido do Lucas em 2026-11-24). O CNPJ da transportadora vai inteiro, quebrando a linha quando não
 * cabe, como um fornecedor pediu.
 */

/** Os dados numa faixa clara, como o cadastro na tela de pedido: aqui nada se muda. */
export function Fatos({ children }: { children: ReactNode }) {
  return <dl className={estilos.fatos}>{children}</dl>;
}

export function CondicoesDoPedido({ condicoes }: { condicoes: CondicoesParaMostrar }) {
  const { transportadora } = condicoes;
  return (
    <Fatos>
      <Fato rotulo="Transportadora" largo>
        {transportadora ? (
          <>
            {transportadora.nome}
            <DetalheDoFato>CNPJ {transportadora.cnpj}</DetalheDoFato>
            <DetalheDoFato>{transportadora.local}</DetalheDoFato>
          </>
        ) : (
          "—"
        )}
      </Fato>
      <Fato rotulo="Condição de pagamento">{condicoes.condicaoDePagamento ?? "—"}</Fato>
      <Fato rotulo="Entrega">{condicoes.entrega}</Fato>
      <Fato rotulo="Ordem de compra">{condicoes.ordemDeCompra ?? "—"}</Fato>
      <Fato rotulo="Classificação da venda">{condicoes.classificacao ?? "—"}</Fato>
      <Fato rotulo={condicoes.xped.rotulo}>{condicoes.xped.texto}</Fato>
      <Fato rotulo="Frete parcial">{condicoes.freteParcial ?? "—"}</Fato>
      {condicoes.pagamentoDoFrete ? <Fato rotulo="Pagamento do frete">{condicoes.pagamentoDoFrete}</Fato> : null}
      {condicoes.observacao ? (
        <Fato rotulo="Observações" largo>
          <span className={estilos.observacao}>{condicoes.observacao}</span>
        </Fato>
      ) : null}
    </Fatos>
  );
}

type ItemComReferencias = OrdemDeCompraDoItem & PartNumberDoItem;

/**
 * As colunas do part number e da ordem de compra do cliente, cada uma só quando algum item tem. A
 * ordem vazia no item é a do pedido.
 */
export function colunasDasReferencias<T extends ItemComReferencias>(itens: readonly T[], ordemDoPedido: string | null): ColunaDaTabela<T>[] {
  const ordemDe = (item: T) => item.ordemDeCompra ?? ordemDoPedido ?? "";
  const colunas: ColunaDaTabela<T>[] = [];
  if (itens.some((item) => item.partNumber !== null)) {
    colunas.push({ titulo: "Part number", largura: 7, ordenarPor: (item) => item.partNumber ?? "", celula: (item) => item.partNumber ?? "—" });
  }
  if (ordemDoPedido || itens.some((item) => item.ordemDeCompra !== null || item.itemDaOrdemDeCompra !== null)) {
    colunas.push({
      titulo: "Ordem de compra",
      largura: 8,
      ordenarPor: ordemDe,
      celula: (item) => [ordemDe(item), item.itemDaOrdemDeCompra === null ? null : `item ${item.itemDaOrdemDeCompra}`].filter(Boolean).join(" · ") || "—",
    });
  }
  return colunas;
}
