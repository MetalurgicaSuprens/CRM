import { Link, useParams, useSearchParams } from "react-router";
import { CircleCheck, Package, Route } from "lucide-react";
import { CabecalhoPagina } from "../componentes/CabecalhoPagina";
import { Cartao } from "../componentes/Cartao";
import { EtapaDoPedido } from "../componentes/EtapaDoPedido";
import { AndamentoDoPedido, ItensDoPedidoEnviado } from "../componentes/PedidoEnviado";
import { Voltar } from "../componentes/Voltar";
import { carregarPedidoEnviado, carregarSituacaoDosDados } from "../dados/api";
import { useCarga } from "../dados/useCarga";
import { formatarMomento } from "../formato";
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
          <AndamentoDoPedido pedido={pedido} relogio={situacao.relogio} />
        </Cartao>
        <Cartao titulo="Itens" icone={Package} subtitulo="Pelos preços da tabela do cliente no momento do envio">
          <ItensDoPedidoEnviado pedido={pedido} />
        </Cartao>
      </div>
    </div>
  );
}
