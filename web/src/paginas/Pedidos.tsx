import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { ClipboardList, FilePen, FilePlus2, ReceiptText, Send, Trash, type LucideIcon } from "lucide-react";
import botoes from "../componentes/Botao.module.css";
import { CabecalhoPagina } from "../componentes/CabecalhoPagina";
import { Cartao } from "../componentes/Cartao";
import { EtapaDoPedido } from "../componentes/EtapaDoPedido";
import { Filtros } from "../componentes/Filtros";
import { Identificacao, TabelaResponsiva } from "../componentes/TabelaResponsiva";
import { Valor } from "../componentes/Valor";
import { carregarPedidos, carregarSituacaoDosDados, excluirRascunho } from "../dados/api";
import type { NotaFaturada, PainelDePedidos, PedidoEnviado, PedidoNoErp, Rascunho } from "../dados/tipos";
import { useCarga } from "../dados/useCarga";
import { formatarContagem, formatarData, formatarTempoDesde } from "../formato";
import { DataRelativa, MomentoRelativo } from "../componentes/Quando";
import { Carregando } from "./Carregando";
import estilos from "./Pedidos.module.css";

type Aba = keyof PainelDePedidos;

/** Nome e ícone de cada aba: os mesmos no filtro e no cartão da lista. */
const ABAS: Record<Aba, { rotulo: string; icone: LucideIcon }> = {
  enviados: { rotulo: "Enviados pelo CRM", icone: Send },
  rascunhos: { rotulo: "Rascunhos", icone: FilePen },
  emAberto: { rotulo: "Em aberto no ERP", icone: ClipboardList },
  faturados: { rotulo: "Faturados", icone: ReceiptText },
};

const ORDEM_DAS_ABAS: readonly Aba[] = ["enviados", "rascunhos", "emAberto", "faturados"];

export function Pedidos() {
  const { dados: painel, recarregar } = useCarga("pedidos", carregarPedidos);
  const { dados: situacao } = useCarga("situacao", carregarSituacaoDosDados);
  const [parametros, setParametros] = useSearchParams();
  const aba = ORDEM_DAS_ABAS.find((opcao) => opcao === parametros.get("aba")) ?? "enviados";
  if (!painel || !situacao) return <Carregando />;
  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        titulo="Pedidos"
        descricao="O que você enviou pelo CRM, os rascunhos e os pedidos do ERP"
        acoes={
          <Link to="/pedidos/novo" className={botoes.primario}>
            <FilePlus2 size={18} aria-hidden="true" />
            Novo pedido
          </Link>
        }
      />
      <Filtros
        rotulo="Pedidos"
        opcoes={ORDEM_DAS_ABAS.map((valor) => ({ valor, ...ABAS[valor], quantidade: painel[valor].length }))}
        selecionado={aba}
        aoEscolher={(valor) => setParametros(valor === "enviados" ? {} : { aba: valor }, { replace: true })}
      />
      <AbaEscolhida aba={aba} painel={painel} hoje={situacao.hoje} recarregar={recarregar} />
    </div>
  );
}

type PropsDaAba = { aba: Aba; painel: PainelDePedidos; hoje: string; recarregar: () => void };

function AbaEscolhida({ aba, painel, hoje, recarregar }: PropsDaAba) {
  switch (aba) {
    case "enviados":
      return <Enviados pedidos={painel.enviados} hoje={hoje} />;
    case "rascunhos":
      return <Rascunhos rascunhos={painel.rascunhos} hoje={hoje} recarregar={recarregar} />;
    case "emAberto":
      return <EmAberto pedidos={painel.emAberto} hoje={hoje} />;
    case "faturados":
      return <Faturados notas={painel.faturados} hoje={hoje} />;
  }
}

/** O cartão de cada lista leva o nome e o ícone da aba. */
function CartaoDaAba({ aba, subtitulo, children }: { aba: Aba; subtitulo: string; children: ReactNode }) {
  const { rotulo, icone } = ABAS[aba];
  return (
    <Cartao titulo={rotulo} icone={icone} subtitulo={subtitulo}>
      {children}
    </Cartao>
  );
}

function Enviados({ pedidos, hoje }: { pedidos: PedidoEnviado[]; hoje: string }) {
  return (
    <CartaoDaAba aba="enviados" subtitulo="Do envio até o faturamento. A situação volta do ERP a cada atualização dos dados.">
      <TabelaResponsiva
        descricao="Pedidos enviados pelo CRM"
        itens={pedidos}
        chaveDe={(pedido) => pedido.numero}
        linkDe={(pedido) => `/pedidos/${pedido.numero}`}
        vazio="Nenhum pedido enviado pelo CRM ainda."
        colunas={[
          { titulo: "Pedido", celula: (pedido) => <Identificacao titulo={pedido.numero} detalhe={pedido.cliente.nome} /> },
          { titulo: "Enviado", celula: (pedido) => <MomentoRelativo momento={pedido.enviadoEm} hoje={hoje} /> },
          { titulo: "Situação", largura: 10, celula: (pedido) => <EtapaDoPedido etapa={pedido.etapa} /> },
          {
            titulo: "Total",
            numerica: true,
            celula: (pedido) => (
              <>
                <Valor valor={pedido.totalSgi ?? pedido.totalEstimado} />
                <span className={estilos.suave}>{pedido.totalSgi === null ? "estimado" : "no SGI"}</span>
              </>
            ),
          },
        ]}
      />
    </CartaoDaAba>
  );
}

function Rascunhos({ rascunhos, hoje, recarregar }: { rascunhos: Rascunho[]; hoje: string; recarregar: () => void }) {
  return (
    <CartaoDaAba aba="rascunhos" subtitulo="Pedidos começados e ainda não enviados. No protótipo, ficam só até recarregar a página.">
      <TabelaResponsiva
        descricao="Rascunhos de pedido"
        itens={rascunhos}
        chaveDe={(rascunho) => rascunho.id}
        vazio="Nenhum rascunho. Os pedidos começados e não enviados aparecem aqui."
        colunas={[
          {
            titulo: "Cliente",
            celula: (rascunho) => <Identificacao titulo={rascunho.cliente.nome} detalhe={`${rascunho.cliente.cidade}/${rascunho.cliente.uf}`} />,
          },
          { titulo: "Produtos", celula: (rascunho) => formatarContagem(rascunho.itens.length, "produto", "produtos") },
          { titulo: "Atualizado", celula: (rascunho) => <MomentoRelativo momento={rascunho.atualizadoEm} hoje={hoje} /> },
          { titulo: "Total estimado", numerica: true, celula: (rascunho) => <Valor valor={rascunho.totalEstimado} /> },
          { titulo: "Ações", largura: 8.5, celula: (rascunho) => <AcoesDoRascunho rascunho={rascunho} aoExcluir={recarregar} /> },
        ]}
      />
    </CartaoDaAba>
  );
}

function AcoesDoRascunho({ rascunho, aoExcluir }: { rascunho: Rascunho; aoExcluir: () => void }) {
  const excluir = () => {
    if (!window.confirm(`Descartar o rascunho de ${rascunho.cliente.nome}?`)) return;
    void excluirRascunho(rascunho.id).then(aoExcluir);
  };
  return (
    <span className={estilos.acoes}>
      <Link to={`/pedidos/rascunhos/${rascunho.id}`} className={`${botoes.secundario} ${estilos.compacto}`}>
        Continuar
      </Link>
      <button type="button" className={botoes.icone} onClick={excluir} aria-label={`Descartar o rascunho de ${rascunho.cliente.nome}`}>
        <Trash size={16} aria-hidden="true" />
      </button>
    </span>
  );
}

function EmAberto({ pedidos, hoje }: { pedidos: PedidoNoErp[]; hoje: string }) {
  return (
    <CartaoDaAba
      aba="emAberto"
      subtitulo="Todos os pedidos da sua carteira ainda não faturados, pelo CRM ou não, da entrega mais próxima à mais distante."
    >
      <TabelaResponsiva
        descricao="Pedidos em aberto no ERP"
        itens={pedidos}
        chaveDe={(pedido) => pedido.numero}
        linkDe={(pedido) => `/clientes/${pedido.cliente.codigo}`}
        vazio="Nenhum pedido em aberto."
        colunas={[
          { titulo: "Pedido", celula: (pedido) => <Identificacao titulo={pedido.numero} detalhe={pedido.cliente.nome} /> },
          { titulo: "Emissão", celula: (pedido) => formatarData(pedido.emissao) },
          { titulo: "Entrega", celula: (pedido) => <DataRelativa data={pedido.entrega} hoje={hoje} /> },
          { titulo: "Itens", numerica: true, celula: (pedido) => pedido.itens },
          { titulo: "Valor", numerica: true, celula: (pedido) => <Valor valor={pedido.valor} /> },
        ]}
      />
    </CartaoDaAba>
  );
}

function Faturados({ notas, hoje }: { notas: NotaFaturada[]; hoje: string }) {
  return (
    <CartaoDaAba aba="faturados" subtitulo="Notas dos últimos 45 dias, da mais recente à mais antiga.">
      <TabelaResponsiva
        descricao="Notas faturadas nos últimos 45 dias"
        itens={notas}
        chaveDe={(nota) => nota.numero}
        linkDe={(nota) => `/clientes/${nota.cliente.codigo}`}
        vazio="Nenhuma nota nos últimos 45 dias."
        colunas={[
          { titulo: "Nota", celula: (nota) => <Identificacao titulo={`NF ${nota.numero}`} detalhe={nota.cliente.nome} /> },
          { titulo: "Emissão", celula: (nota) => <span title={formatarData(nota.emissao)}>{formatarTempoDesde(nota.emissao, hoje)}</span> },
          { titulo: "Valor", numerica: true, celula: (nota) => <Valor valor={nota.valor} /> },
        ]}
      />
    </CartaoDaAba>
  );
}
