import type { ReactNode } from "react";
import { ClipboardCheck } from "lucide-react";
import { valorDaLinha } from "dominio/pedido";
import { Cartao } from "../../componentes/Cartao";
import { Valor } from "../../componentes/Valor";
import { ROTULOS_DA_CLASSIFICACAO, nomeDaTransportadora, type TotaisDoPedido } from "../../dados/dadosDoPedido";
import type { LinhaEscolhida } from "../../dados/pedido";
import type { DadosDoPedido, EscolhasDoPedido } from "../../dados/tipos";
import { formatarContagem, formatarDataCurta, formatarNumero } from "../../formato";
import estilos from "./RevisaoDoPedido.module.css";

/*
 * O pedido de relance, antes de enviar: no celular, é a última etapa, com os itens e o que falta; na
 * confirmação do envio, só o resumo.
 */

export type PedidoParaRevisar = {
  cliente: string;
  totais: TotaisDoPedido;
  /** A data da entrega: a programada ou, no "assim que possível", a primeira possível. */
  entrega: string;
  isProgramada: boolean;
  dados: DadosDoPedido | null;
  escolhas: EscolhasDoPedido | null;
};

/** Cliente, entrega, transportadora, pagamento, a venda e os totais: o que mais dá problema quando sai errado. */
export function ResumoDoPedido({ cliente, totais, entrega, isProgramada, dados, escolhas }: PedidoParaRevisar) {
  const comEscolhas = dados && escolhas ? { dados, escolhas } : null;
  return (
    <dl className={estilos.resumo}>
      <Linha rotulo="Cliente">{cliente}</Linha>
      <Linha rotulo="Entrega">
        {isProgramada ? "Programada para" : "Assim que possível, a partir de"} {formatarDataCurta(entrega)}
      </Linha>
      {comEscolhas ? <EscolhasNoResumo {...comEscolhas} /> : null}
      <Linha rotulo="Total">
        {formatarContagem(totais.itens, "item", "itens")} · {formatarNumero(totais.pecas)} pç · <Valor valor={totais.semIpi} comCentavos />
        {totais.comIpi !== null ? (
          <>
            {" "}
            · com IPI <Valor valor={totais.comIpi} comCentavos />
          </>
        ) : null}
      </Linha>
    </dl>
  );
}

function EscolhasNoResumo({ dados, escolhas }: { dados: DadosDoPedido; escolhas: EscolhasDoPedido }) {
  const { transportadora } = escolhas;
  const pagamento = dados.condicoes.find((condicao) => condicao.codigo === escolhas.condicaoDePagamento)?.descricao ?? escolhas.condicaoDePagamento;
  return (
    <>
      <Linha rotulo="Transportadora">
        {transportadora ? nomeDaTransportadora(dados, transportadora) : <span className={estilos.falta}>Falta escolher</span>}
        {transportadora && "nova" in transportadora ? <span className={estilos.falta}> (nova: espera o cadastro de vendas)</span> : null}
      </Linha>
      <Linha rotulo="Pagamento">
        {pagamento}
        {escolhas.condicaoDePagamento === dados.condicaoDoCadastro ? null : <span className={estilos.falta}> (fora do cadastro: vai para aprovação)</span>}
      </Linha>
      <Linha rotulo="Venda">
        {ROTULOS_DA_CLASSIFICACAO[escolhas.classificacao]} · {escolhas.aceitaParcial ? "aceita frete parcial" : "não aceita frete parcial"}
      </Linha>
      {escolhas.pedidoDoCliente.trim() ? <Linha rotulo="Ordem de compra">{escolhas.pedidoDoCliente.trim()}</Linha> : null}
    </>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className={estilos.linha}>
      <dt>{rotulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}

type PropsDaRevisao = { pedido: PedidoParaRevisar; linhas: readonly LinhaEscolhida[]; observacao: string; problemas: readonly string[] };

/** A última etapa no celular: o resumo, os itens e, se houver, o que falta para enviar. */
export function RevisaoDoPedido({ pedido, linhas, observacao, problemas }: PropsDaRevisao) {
  return (
    <Cartao titulo="Revisar o pedido" icone={ClipboardCheck} subtitulo="Confira antes de enviar: depois, não dá para alterar pelo CRM.">
      {problemas.length > 0 ? (
        <ul className={estilos.problemas} role="status">
          {problemas.map((problema) => (
            <li key={problema}>{problema}</li>
          ))}
        </ul>
      ) : null}
      <ResumoDoPedido {...pedido} />
      {observacao.trim() ? <p className={estilos.observacao}>Observações: {observacao.trim()}</p> : null}
      <ul className={estilos.itens}>
        {linhas.map((linha) => (
          <li key={linha.codigo} className={estilos.item}>
            <span className={estilos.codigo}>{linha.codigo}</span>
            <span className={estilos.pecas}>{formatarNumero(linha.quantidade)} pç</span>
            <Valor valor={valorDaLinha(linha)} comCentavos />
          </li>
        ))}
      </ul>
    </Cartao>
  );
}
