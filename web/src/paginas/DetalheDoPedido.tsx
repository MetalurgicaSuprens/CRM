import { Link, useParams, useSearchParams } from "react-router";
import { CircleCheck, Package, Route } from "lucide-react";
import { CabecalhoPagina } from "../componentes/CabecalhoPagina";
import { Cartao } from "../componentes/Cartao";
import { ETAPAS, EtapaDoPedido } from "../componentes/EtapaDoPedido";
import { Identificacao, TabelaResponsiva } from "../componentes/TabelaResponsiva";
import { Valor } from "../componentes/Valor";
import { Voltar } from "../componentes/Voltar";
import { carregarPedidoEnviado, carregarSituacaoDosDados } from "../dados/api";
import { passosDoAndamento, valorDaLinha, type PassoDoAndamento } from "../dados/pedido";
import type { PedidoEnviado } from "../dados/tipos";
import { useCarga } from "../dados/useCarga";
import { formatarData, formatarMomento, formatarNumero } from "../formato";
import { Carregando } from "./Carregando";
import estilos from "./DetalheDoPedido.module.css";

export function DetalheDoPedido() {
  const { numero = "" } = useParams();
  const [parametros] = useSearchParams();
  const { dados: pedido, carregando } = useCarga(`pedido:${numero}`, () => carregarPedidoEnviado(numero));
  const { dados: situacao } = useCarga("situacao", carregarSituacaoDosDados);
  if (carregando || !situacao) return <Carregando />;
  if (!pedido) {
    return (
      <div className={estilos.pagina}>
        <Voltar para="/pedidos" rotulo="Pedidos" />
        <p className={estilos.suave}>Pedido não encontrado.</p>
      </div>
    );
  }
  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        antes={<Voltar para="/pedidos" rotulo="Pedidos" />}
        titulo={`Pedido ${pedido.numero}`}
        selo={<EtapaDoPedido etapa={pedido.etapa} tamanho="grande" />}
        descricao={
          <>
            Para <Link to={`/clientes/${pedido.cliente.codigo}`}>{pedido.cliente.nome}</Link> · enviado{" "}
            {formatarMomento(pedido.enviadoEm, situacao.relogio)}
          </>
        }
      />
      {parametros.get("enviado") === "1" ? (
        <p className={estilos.enviado} role="status">
          <CircleCheck size={16} aria-hidden="true" />
          Pedido enviado. Ele chega ao SGI em até 5 minutos, e a situação aparece aqui a cada atualização dos dados.
        </p>
      ) : null}
      <div className={estilos.grade}>
        <Cartao titulo="Andamento" icone={Route} subtitulo="Do envio pelo CRM até o faturamento">
          <LinhaDoTempo pedido={pedido} relogio={situacao.relogio} />
        </Cartao>
        <Cartao titulo="Itens" icone={Package} subtitulo="Pelos preços da tabela do cliente no momento do envio">
          <TabelaResponsiva
            descricao="Itens do pedido"
            itens={pedido.itens}
            chaveDe={(item) => item.codigo}
            vazio="Pedido sem itens."
            colunas={[
              { titulo: "Produto", ordenarPor: (item) => item.codigo, celula: (item) => <Identificacao titulo={item.codigo} detalhe={`${item.familia} · ${item.medida}`} /> },
              { titulo: "Peças", numerica: true, largura: 5, ordenarPor: (item) => item.quantidade, celula: (item) => formatarNumero(item.quantidade) },
              { titulo: "Cento", numerica: true, largura: 5.5, ordenarPor: (item) => item.precoCento, celula: (item) => <Valor valor={item.precoCento} /> },
              { titulo: "Valor", numerica: true, ordenarPor: valorDaLinha, celula: (item) => <Valor valor={valorDaLinha(item)} /> },
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
        </Cartao>
      </div>
    </div>
  );
}

function Totais({ pedido }: { pedido: PedidoEnviado }) {
  return (
    <div className={estilos.totais}>
      <div className={estilos.linhaDoTotal}>
        <span>Estimativa do CRM</span>
        <Valor valor={pedido.totalEstimado} />
      </div>
      {pedido.totalSgi === null ? (
        <p className={estilos.suave}>O SGI recalcula o total quando recebe o pedido.</p>
      ) : (
        <div className={`${estilos.linhaDoTotal} ${estilos.totalDoSgi}`}>
          <span>Total no SGI</span>
          <Valor valor={pedido.totalSgi} />
        </div>
      )}
    </div>
  );
}

function LinhaDoTempo({ pedido, relogio }: { pedido: PedidoEnviado; relogio: string }) {
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
