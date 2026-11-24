import { Link, useParams, useSearchParams } from "react-router";
import { CircleCheck, FileText, Package, Route, SlidersHorizontal } from "lucide-react";
import botoes from "../componentes/Botao.module.css";
import { CabecalhoPagina } from "../componentes/CabecalhoPagina";
import { Cartao } from "../componentes/Cartao";
import { EtapaDoPedido } from "../componentes/EtapaDoPedido";
import { AndamentoDoPedido, CondicoesDoPedidoEnviado, ItensDoPedidoEnviado } from "../componentes/PedidoEnviado";
import { Voltar } from "../componentes/Voltar";
import { carregarCatalogo, carregarPedidoEnviado, carregarSituacaoDosDados } from "../dados/api";
import type { PedidoEnviado } from "../dados/tipos";
import { useCarga } from "../dados/useCarga";
import { formatarMomento } from "../formato";
import { Carregando } from "./Carregando";
import estilos from "./DetalheDoPedido.module.css";

export function DetalheDoPedido() {
  const { numero = "" } = useParams();
  const { dados: pedido, carregando } = useCarga(`pedido:${numero}`, () => carregarPedidoEnviado(numero));
  if (carregando) return <Carregando />;
  if (!pedido) {
    return (
      <div className={estilos.pagina}>
        <Voltar para="/pedidos" rotulo="Pedidos" />
        <p className={estilos.suave}>Pedido não encontrado.</p>
      </div>
    );
  }
  return <PaginaDoPedido pedido={pedido} />;
}

/** O pedido como foi enviado, com tudo o que o representante preencheu, e o andamento até o faturamento. */
function PaginaDoPedido({ pedido }: { pedido: PedidoEnviado }) {
  const [parametros] = useSearchParams();
  const codigo = pedido.cliente.codigo;
  const { dados: catalogo, carregando } = useCarga(`catalogo:${codigo}`, () => carregarCatalogo(codigo));
  const { dados: situacao } = useCarga("situacao", carregarSituacaoDosDados);
  if (carregando || !situacao) return <Carregando />;
  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        antes={<Voltar para="/pedidos" rotulo="Pedidos" />}
        titulo={`Pedido ${pedido.numero}`}
        selo={<EtapaDoPedido etapa={pedido.etapa} tamanho="grande" />}
        descricao={
          <>
            Para <Link to={`/clientes/${codigo}`}>{pedido.cliente.nome}</Link> · enviado {formatarMomento(pedido.enviadoEm, situacao.relogio)}
          </>
        }
        acoes={
          <Link to={`/pedidos/${pedido.numero}/pdf`} className={botoes.secundario}>
            <FileText size={18} aria-hidden="true" />
            PDF do pedido
          </Link>
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
        <Cartao titulo="Cliente e condições" icone={SlidersHorizontal} subtitulo="Como foram enviados">
          <CondicoesDoPedidoEnviado pedido={pedido} dados={catalogo?.dadosDoPedido ?? null} />
        </Cartao>
      </div>
      <Cartao titulo="Itens" icone={Package} subtitulo="Pelos preços do envio; o IPI, pelas alíquotas do ERP">
        <ItensDoPedidoEnviado pedido={pedido} catalogo={catalogo} />
      </Cartao>
    </div>
  );
}
