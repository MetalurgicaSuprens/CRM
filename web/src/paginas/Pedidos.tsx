import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { FilePlus2, Trash, type LucideIcon } from "lucide-react";
import botoes from "../componentes/Botao.module.css";
import { CabecalhoPagina } from "../componentes/CabecalhoPagina";
import { CampoDeBusca } from "../componentes/CampoDeBusca";
import { Cartao } from "../componentes/Cartao";
import { ETAPAS, EtapaDoPedido } from "../componentes/EtapaDoPedido";
import { Filtros } from "../componentes/Filtros";
import type { TomDoSelo } from "../componentes/Selo";
import { STATUS_DO_PEDIDO } from "../componentes/StatusDoPedido";
import travada from "../componentes/PaginaTravada.module.css";
import { Identificacao, TabelaResponsiva, type ColunaDaTabela } from "../componentes/TabelaResponsiva";
import { Valor } from "../componentes/Valor";
import { carregarPedidos, carregarSituacaoDosDados, excluirCotacao, isDadosReais } from "../dados/api";
import { correspondeAoCliente } from "../dados/busca";
import type { ClienteResumo, NotaFaturada, PainelDePedidos, PedidoEnviado, PedidoNoErp, Cotacao, SituacaoDosDados } from "../dados/tipos";
import { useCarga } from "../dados/useCarga";
import { formatarContagem, formatarData, formatarDocumentoDoCliente, formatarTempoDesde } from "../formato";
import { DataRelativa, MomentoRelativo } from "../componentes/Quando";
import { Carregando } from "./Carregando";
import { DetalheDaNota, DetalheDoEnviado, DetalheDoPedidoNoErp } from "./DetalhesDosPedidos";
import estilos from "./Pedidos.module.css";

type Aba = keyof PainelDePedidos;

/** Nome, ícone e tom de cada aba: os mesmos no filtro e no cartão da lista, e o ícone e o tom do status. */
const ABAS: Record<Aba, { rotulo: string; icone: LucideIcon; tom: TomDoSelo }> = {
  faturados: { ...STATUS_DO_PEDIDO.faturado, rotulo: "Faturados" },
  emAberto: { ...STATUS_DO_PEDIDO.em_aberto, rotulo: "Em aberto no ERP" },
  enviados: { ...STATUS_DO_PEDIDO.enviado, rotulo: "Enviados pelo CRM" },
  cotacoes: { ...STATUS_DO_PEDIDO.cotacao, rotulo: "Cotações" },
};

/** A ordem dos cartões; a página abre no primeiro. */
const ORDEM_DAS_ABAS: readonly Aba[] = ["faturados", "emAberto", "enviados", "cotacoes"];
const ABA_INICIAL: Aba = "faturados";
/** A lista vazia por causa da busca de cliente, no lugar do texto de cada aba. */
const SEM_RESULTADO = "Nada nesta aba para esse cliente.";

type ComCliente = { cliente: ClienteResumo };

/**
 * O cliente e o documento em colunas próprias, iguais em todas as abas, como no app antigo dos
 * representantes. As outras colunas são fixas: a sobra da largura vai toda para o nome do cliente.
 */
function colunasDoCliente<T extends ComCliente>(): [ColunaDaTabela<T>, ColunaDaTabela<T>] {
  return [
    {
      titulo: "Cliente",
      largura: 11,
      ordenarPor: (item) => item.cliente.nome,
      celula: (item) => <Identificacao titulo={item.cliente.nome} detalhe={`${item.cliente.cidade}/${item.cliente.uf}`} />,
    },
    { titulo: "CNPJ/CPF", largura: 9.5, fixa: true, ordenarPor: (item) => formatarDocumentoDoCliente(item.cliente), celula: (item) => formatarDocumentoDoCliente(item.cliente) },
  ];
}

export function Pedidos() {
  const { dados: painel, recarregar } = useCarga("pedidos", carregarPedidos);
  const { dados: situacao } = useCarga("situacao", carregarSituacaoDosDados);
  const [parametros, setParametros] = useSearchParams();
  const aba = ORDEM_DAS_ABAS.find((opcao) => opcao === parametros.get("aba")) ?? ABA_INICIAL;
  const busca = parametros.get("busca") ?? "";
  if (!painel || !situacao) return <Carregando />;
  const doCliente = filtrarPorCliente(painel, busca);
  const buscar = (valor: string) => {
    const proximos = new URLSearchParams(parametros);
    if (valor) proximos.set("busca", valor);
    else proximos.delete("busca");
    setParametros(proximos, { replace: true });
  };
  return (
    <div className={`${estilos.pagina} ${travada.pagina}`}>
      <CabecalhoPagina
        titulo="Pedidos"
        descricao="Os pedidos do ERP, o que você enviou pelo CRM e as cotações"
        naLinhaDaDescricao={<CampoDeBusca rotulo="Buscar cliente" valor={busca} dica="Cliente: nome fantasia ou CNPJ" aoMudar={buscar} className={estilos.busca} />}
        acoes={
          <Link to="/pedidos/novo" className={`${botoes.primario} ${botoes.positivo}`}>
            <FilePlus2 size={18} aria-hidden="true" />
            Incluir pedido
          </Link>
        }
      />
      <Filtros
        rotulo="Pedidos"
        opcoes={ORDEM_DAS_ABAS.map((valor) => ({ valor, ...ABAS[valor], quantidade: doCliente[valor].length }))}
        selecionado={aba}
        aoEscolher={(valor) => setParametros(parametrosDaAba(valor, busca), { replace: true })}
      />
      <AbaEscolhida aba={aba} painel={doCliente} situacao={situacao} recarregar={recarregar} vazio={busca.trim() ? SEM_RESULTADO : undefined} />
    </div>
  );
}

/** Trocar de aba recomeça a ordem e mantém a busca de cliente. */
function parametrosDaAba(aba: Aba, busca: string): Record<string, string> {
  return { ...(aba === ABA_INICIAL ? {} : { aba }), ...(busca ? { busca } : {}) };
}

/** Cada aba só com os pedidos e as notas dos clientes que correspondem à busca. */
function filtrarPorCliente(painel: PainelDePedidos, busca: string): PainelDePedidos {
  const doCliente = <T extends { cliente: ClienteResumo }>(lista: T[]) => lista.filter((item) => correspondeAoCliente(item.cliente, busca));
  return {
    enviados: doCliente(painel.enviados),
    cotacoes: doCliente(painel.cotacoes),
    emAberto: doCliente(painel.emAberto),
    faturados: doCliente(painel.faturados),
  };
}

/** `vazio` troca o texto da lista vazia de cada aba. */
type PropsDaAba = { aba: Aba; painel: PainelDePedidos; situacao: SituacaoDosDados; recarregar: () => void; vazio: string | undefined };

/** O que o CRM grava se compara com o relógio; o que vem do ERP, com a data da foto. */
function AbaEscolhida({ aba, painel, situacao, recarregar, vazio }: PropsDaAba) {
  switch (aba) {
    case "enviados":
      return <Enviados pedidos={painel.enviados} relogio={situacao.relogio} vazio={vazio} />;
    case "cotacoes":
      return <Cotacoes cotacoes={painel.cotacoes} relogio={situacao.relogio} recarregar={recarregar} vazio={vazio} />;
    case "emAberto":
      return <EmAberto pedidos={painel.emAberto} hoje={situacao.hoje} vazio={vazio} />;
    case "faturados":
      return <Faturados notas={painel.faturados} hoje={situacao.hoje} vazio={vazio} />;
  }
}

/** O cartão de cada lista leva o nome, o ícone e o tom da aba. */
function CartaoDaAba({ aba, subtitulo, children }: { aba: Aba; subtitulo: string; children: ReactNode }) {
  const { rotulo, icone, tom } = ABAS[aba];
  return (
    <Cartao titulo={rotulo} icone={icone} tom={tom === "neutro" ? undefined : tom} subtitulo={subtitulo} className={travada.estica}>
      {children}
    </Cartao>
  );
}

function Enviados({ pedidos, relogio, vazio }: { pedidos: PedidoEnviado[]; relogio: string; vazio: string | undefined }) {
  return (
    <CartaoDaAba aba="enviados" subtitulo="Do envio até o faturamento. A situação volta do ERP a cada atualização dos dados.">
      <TabelaResponsiva
        className={travada.rola}
        descricao="Pedidos enviados pelo CRM"
        itens={pedidos}
        chaveDe={(pedido) => pedido.numero}
        detalheDe={(pedido) => <DetalheDoEnviado pedido={pedido} relogio={relogio} />}
        vazio={vazio ?? "Nenhum pedido enviado pelo CRM ainda."}
        ordemInicial={{ coluna: "Enviado", sentido: "decrescente" }}
        colunas={[
          { titulo: "Pedido", largura: 5.5, fixa: true, ordenarPor: (pedido) => pedido.numero, celula: (pedido) => pedido.numero },
          ...colunasDoCliente<PedidoEnviado>(),
          { titulo: "Enviado", largura: 7, fixa: true, ordenarPor: (pedido) => pedido.enviadoEm, celula: (pedido) => <MomentoRelativo momento={pedido.enviadoEm} relogio={relogio} /> },
          { titulo: "Situação", largura: 10, fixa: true, ordenarPor: (pedido) => ETAPAS[pedido.etapa].rotulo, celula: (pedido) => <EtapaDoPedido etapa={pedido.etapa} /> },
          {
            titulo: "Total",
            numerica: true,
            largura: 7.5,
            fixa: true,
            ordenarPor: (pedido) => pedido.totalSgi ?? pedido.totalEstimado,
            celula: (pedido) => (
              <>
                <Valor valor={pedido.totalSgi ?? pedido.totalEstimado} comCentavos />
                <span className={estilos.suave}>{pedido.totalSgi === null ? "estimado" : "no SGI"}</span>
              </>
            ),
          },
        ]}
      />
    </CartaoDaAba>
  );
}

const SUBTITULO_DOS_COTACOES = isDadosReais
  ? "Pedidos começados e ainda não enviados: ficam guardados até você enviar ou descartar."
  : "Pedidos começados e ainda não enviados. No protótipo, ficam só até recarregar a página.";

function Cotacoes({ cotacoes, relogio, recarregar, vazio }: { cotacoes: Cotacao[]; relogio: string; recarregar: () => void; vazio: string | undefined }) {
  return (
    <CartaoDaAba aba="cotacoes" subtitulo={SUBTITULO_DOS_COTACOES}>
      <TabelaResponsiva
        className={travada.rola}
        descricao="Cotações"
        itens={cotacoes}
        chaveDe={(cotacao) => cotacao.id}
        vazio={vazio ?? "Nenhuma cotação. Os pedidos começados e não enviados aparecem aqui."}
        ordemInicial={{ coluna: "Atualizado", sentido: "decrescente" }}
        colunas={[
          ...colunasDoCliente<Cotacao>(),
          { titulo: "Produtos", largura: 6.5, fixa: true, ordenarPor: (cotacao) => cotacao.itens.length, celula: (cotacao) => formatarContagem(cotacao.itens.length, "produto", "produtos") },
          { titulo: "Atualizado", largura: 7, fixa: true, ordenarPor: (cotacao) => cotacao.atualizadoEm, celula: (cotacao) => <MomentoRelativo momento={cotacao.atualizadoEm} relogio={relogio} /> },
          { titulo: "Total estimado", numerica: true, largura: 8, fixa: true, ordenarPor: (cotacao) => cotacao.totalEstimado, celula: (cotacao) => <Valor valor={cotacao.totalEstimado} comCentavos /> },
          { titulo: "Ações", largura: 12, fixa: true, celula: (cotacao) => <AcoesDoCotacao cotacao={cotacao} aoExcluir={recarregar} /> },
        ]}
      />
    </CartaoDaAba>
  );
}

function AcoesDoCotacao({ cotacao, aoExcluir }: { cotacao: Cotacao; aoExcluir: () => void }) {
  const excluir = () => {
    if (!window.confirm(`Descartar a cotação de ${cotacao.cliente.nome}?`)) return;
    void excluirCotacao(cotacao.id).then(aoExcluir);
  };
  return (
    <span className={estilos.acoes}>
      <Link to={`/pedidos/cotacoes/${cotacao.id}`} className={`${botoes.secundario} ${estilos.compacto}`}>
        Continuar
      </Link>
      <Link to={`/pedidos/cotacoes/${cotacao.id}/pdf`} className={`${botoes.secundario} ${estilos.compacto}`} aria-label={`PDF da cotação de ${cotacao.cliente.nome}`}>
        PDF
      </Link>
      <button type="button" className={botoes.icone} onClick={excluir} aria-label={`Descartar a cotação de ${cotacao.cliente.nome}`}>
        <Trash size={16} aria-hidden="true" />
      </button>
    </span>
  );
}

function EmAberto({ pedidos, hoje, vazio }: { pedidos: PedidoNoErp[]; hoje: string; vazio: string | undefined }) {
  return (
    <CartaoDaAba
      aba="emAberto"
      subtitulo="Todos os pedidos da sua carteira ainda não faturados, pelo CRM ou não."
    >
      <TabelaResponsiva
        className={travada.rola}
        descricao="Pedidos em aberto no ERP"
        itens={pedidos}
        chaveDe={(pedido) => pedido.numero}
        detalheDe={(pedido) => <DetalheDoPedidoNoErp pedido={pedido} hoje={hoje} />}
        vazio={vazio ?? "Nenhum pedido em aberto."}
        ordemInicial={{ coluna: "Entrega", sentido: "crescente" }}
        colunas={[
          { titulo: "Pedido", largura: 5.5, fixa: true, ordenarPor: (pedido) => pedido.numero, celula: (pedido) => pedido.numero },
          ...colunasDoCliente<PedidoNoErp>(),
          { titulo: "Emissão", largura: 5.5, fixa: true, ordenarPor: (pedido) => pedido.emissao, celula: (pedido) => formatarData(pedido.emissao) },
          { titulo: "Entrega", largura: 6, fixa: true, ordenarPor: (pedido) => pedido.entrega, celula: (pedido) => <DataRelativa data={pedido.entrega} hoje={hoje} /> },
          { titulo: "Itens", numerica: true, largura: 3.5, fixa: true, ordenarPor: (pedido) => pedido.itens, celula: (pedido) => pedido.itens },
          { titulo: "Sem IPI", numerica: true, largura: 7, fixa: true, ordenarPor: (pedido) => pedido.valor, celula: (pedido) => <Valor valor={pedido.valor} comCentavos /> },
          { titulo: "Com IPI", numerica: true, largura: 7, fixa: true, ordenarPor: (pedido) => pedido.valorComIpi, celula: (pedido) => <Valor valor={pedido.valorComIpi} comCentavos /> },
        ]}
      />
    </CartaoDaAba>
  );
}

function Faturados({ notas, hoje, vazio }: { notas: NotaFaturada[]; hoje: string; vazio: string | undefined }) {
  return (
    <CartaoDaAba aba="faturados" subtitulo="Notas dos últimos 45 dias.">
      <TabelaResponsiva
        className={travada.rola}
        descricao="Notas faturadas nos últimos 45 dias"
        itens={notas}
        chaveDe={(nota) => nota.id}
        detalheDe={(nota) => <DetalheDaNota nota={nota} />}
        vazio={vazio ?? "Nenhuma nota nos últimos 45 dias."}
        ordemInicial={{ coluna: "Emissão", sentido: "decrescente" }}
        colunas={[
          { titulo: "Nota", largura: 6, fixa: true, ordenarPor: (nota) => nota.numero, celula: (nota) => `NF ${nota.numero}` },
          { titulo: "Pedido", largura: 5.5, fixa: true, ordenarPor: (nota) => nota.pedidos[0] ?? null, celula: (nota) => (nota.pedidos.length > 0 ? nota.pedidos.join(", ") : "—") },
          ...colunasDoCliente<NotaFaturada>(),
          { titulo: "Emissão", largura: 5.5, fixa: true, ordenarPor: (nota) => nota.emissao, celula: (nota) => <span title={formatarData(nota.emissao)}>{formatarTempoDesde(nota.emissao, hoje)}</span> },
          { titulo: "Sem IPI", numerica: true, largura: 7, fixa: true, ordenarPor: (nota) => nota.valor, celula: (nota) => <Valor valor={nota.valor} comCentavos /> },
          { titulo: "Total da nota", numerica: true, largura: 8, fixa: true, ordenarPor: (nota) => nota.valorTotal, celula: (nota) => <Valor valor={nota.valorTotal} comCentavos /> },
        ]}
      />
    </CartaoDaAba>
  );
}
