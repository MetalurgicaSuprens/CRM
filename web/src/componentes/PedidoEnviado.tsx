import { passosDoAndamento, valorDaLinha, type PassoDoAndamento } from "../dados/pedido";
import type { PedidoEnviado } from "../dados/tipos";
import { formatarData, formatarMomento, formatarNumero } from "../formato";
import { ETAPAS } from "./EtapaDoPedido";
import { Identificacao, ORDEM_DOS_ITENS, TabelaResponsiva } from "./TabelaResponsiva";
import { Valor } from "./Valor";
import estilos from "./PedidoEnviado.module.css";

/*
 * O pedido enviado pelo CRM, na página do pedido e na linha aberta da aba Enviados.
 */

/** Do envio até o faturamento: o que já aconteceu, a situação atual e o que falta. */
export function AndamentoDoPedido({ pedido, relogio }: { pedido: PedidoEnviado; relogio: string }) {
  return (
    <ol className={estilos.linhaDoTempo}>
      {passosDoAndamento(pedido).map((passo) => (
        <li key={passo.etapa} className={`${estilos.passo} ${estilos[passo.estado]} ${pedido.etapa === "recusado" && passo.estado === "atual" ? estilos.recusado : ""}`}>
          <span className={estilos.marcador} aria-hidden="true" />
          <span className={estilos.textoDoPasso}>
            <span className={estilos.nomeDoPasso}>
              {ETAPAS[passo.etapa].rotulo}
              <span className="visualmente-oculto">{passo.estado === "feito" ? ", feito" : passo.estado === "atual" ? ", situação atual" : ", ainda não"}</span>
            </span>
            {passo.em ? <span className={estilos.suave}>{formatarMomento(passo.em, relogio)}</span> : null}
            <DetalheDoPasso passo={passo} pedido={pedido} />
          </span>
        </li>
      ))}
    </ol>
  );
}

function DetalheDoPasso({ passo, pedido }: { passo: PassoDoAndamento; pedido: PedidoEnviado }) {
  if (passo.estado === "futuro") return null;
  switch (passo.etapa) {
    case "recebido":
      return pedido.numeroSgi ? <span className={estilos.detalhe}>Número no SGI: {pedido.numeroSgi}</span> : null;
    case "em_aprovacao":
      return <span className={estilos.detalhe}>Bloqueado no SGI até as aprovações de sempre.</span>;
    case "no_erp":
      return pedido.numeroErp ? <span className={estilos.detalhe}>Número no ERP: {pedido.numeroErp}</span> : null;
    case "recusado":
      return pedido.motivoRecusa ? <span className={`${estilos.detalhe} ${estilos.motivo}`}>{pedido.motivoRecusa}</span> : null;
    default:
      return null;
  }
}

/** Os itens pelos preços do envio, os totais do CRM e do SGI, a entrega desejada e a observação. */
export function ItensDoPedidoEnviado({ pedido }: { pedido: PedidoEnviado }) {
  return (
    <div className={estilos.itens}>
      <TabelaResponsiva
        descricao={`Itens do pedido ${pedido.numero}`}
        itens={pedido.itens}
        chaveDe={(item) => item.codigo}
        vazio="Pedido sem itens."
        parametroDaOrdem={ORDEM_DOS_ITENS}
        colunas={[
          { titulo: "Produto", ordenarPor: (item) => item.codigo, celula: (item) => <Identificacao titulo={item.codigo} detalhe={[item.familia, item.medida].filter(Boolean).join(" · ")} /> },
          { titulo: "Peças", numerica: true, largura: 5, ordenarPor: (item) => item.quantidade, celula: (item) => formatarNumero(item.quantidade) },
          { titulo: "Cento", numerica: true, largura: 5.5, ordenarPor: (item) => item.precoCento, celula: (item) => <Valor valor={item.precoCento} comCentavos /> },
          { titulo: "Valor", numerica: true, ordenarPor: valorDaLinha, celula: (item) => <Valor valor={valorDaLinha(item)} comCentavos /> },
        ]}
      />
      <Totais pedido={pedido} />
      {pedido.entrega || pedido.observacao ? (
        <dl className={estilos.extras}>
          {pedido.entrega ? (
            <div>
              <dt>Entrega desejada</dt>
              <dd>{formatarData(pedido.entrega)}</dd>
            </div>
          ) : null}
          {pedido.observacao ? (
            <div>
              <dt>Observação</dt>
              <dd>{pedido.observacao}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}

function Totais({ pedido }: { pedido: PedidoEnviado }) {
  return (
    <div className={estilos.totais}>
      <div className={estilos.linhaDoTotal}>
        <span>Estimativa do CRM</span>
        <Valor valor={pedido.totalEstimado} comCentavos />
      </div>
      {pedido.totalSgi === null ? (
        <p className={estilos.suave}>O SGI recalcula o total quando recebe o pedido.</p>
      ) : (
        <div className={`${estilos.linhaDoTotal} ${estilos.totalDoSgi}`}>
          <span>Total no SGI</span>
          <Valor valor={pedido.totalSgi} comCentavos />
        </div>
      )}
    </div>
  );
}
