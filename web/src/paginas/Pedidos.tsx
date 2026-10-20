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
import { Identificacao, TabelaResponsiva } from "../componentes/TabelaResponsiva";
import { Valor } from "../componentes/Valor";
import { carregarPedidos, carregarSituacaoDosDados, excluirRascunho } from "../dados/api";
import { correspondeAoCliente } from "../dados/busca";
import type { ClienteResumo, NotaFaturada, PainelDePedidos, PedidoEnviado, PedidoNoErp, Rascunho, SituacaoDosDados } from "../dados/tipos";
import { useCarga } from "../dados/useCarga";
import { formatarContagem, formatarData, formatarTempoDesde } from "../formato";
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
  rascunhos: { ...STATUS_DO_PEDIDO.rascunho, rotulo: "Rascunhos" },
};

/** A ordem dos cartões; a página abre no primeiro. */
const ORDEM_DAS_ABAS: readonly Aba[] = ["faturados", "emAberto", "enviados", "rascunhos"];
const ABA_INICIAL: Aba = "faturados";
/** A lista vazia por causa da busca de cliente, no lugar do texto de cada aba. */
const SEM_RESULTADO = "Nada nesta aba para esse cliente.";

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
        descricao="Os pedidos do ERP, o que você enviou pelo CRM e os rascunhos"
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
    rascunhos: doCliente(painel.rascunhos),
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
    case "rascunhos":
      return <Rascunhos rascunhos={painel.rascunhos} relogio={situacao.relogio} recarregar={recarregar} vazio={vazio} />;
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
          { titulo: "Pedido", ordenarPor: (pedido) => pedido.numero, celula: (pedido) => <Identificacao titulo={pedido.numero} detalhe={pedido.cliente.nome} /> },
          { titulo: "Enviado", ordenarPor: (pedido) => pedido.enviadoEm, celula: (pedido) => <MomentoRelativo momento={pedido.enviadoEm} relogio={relogio} /> },
          { titulo: "Situação", largura: 10, ordenarPor: (pedido) => ETAPAS[pedido.etapa].rotulo, celula: (pedido) => <EtapaDoPedido etapa={pedido.etapa} /> },
          {
            titulo: "Total",
            numerica: true,
            ordenarPor: (pedido) => pedido.totalSgi ?? pedido.totalEstimado,
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

function Rascunhos({ rascunhos, relogio, recarregar, vazio }: { rascunhos: Rascunho[]; relogio: string; recarregar: () => void; vazio: string | undefined }) {
  return (
    <CartaoDaAba aba="rascunhos" subtitulo="Pedidos começados e ainda não enviados. No protótipo, ficam só até recarregar a página.">
      <TabelaResponsiva
        className={travada.rola}
        descricao="Rascunhos de pedido"
        itens={rascunhos}
        chaveDe={(rascunho) => rascunho.id}
        vazio={vazio ?? "Nenhum rascunho. Os pedidos começados e não enviados aparecem aqui."}
        ordemInicial={{ coluna: "Atualizado", sentido: "decrescente" }}
        colunas={[
          {
            titulo: "Cliente",
            ordenarPor: (rascunho) => rascunho.cliente.nome,
            celula: (rascunho) => <Identificacao titulo={rascunho.cliente.nome} detalhe={`${rascunho.cliente.cidade}/${rascunho.cliente.uf}`} />,
          },
          { titulo: "Produtos", ordenarPor: (rascunho) => rascunho.itens.length, celula: (rascunho) => formatarContagem(rascunho.itens.length, "produto", "produtos") },
          { titulo: "Atualizado", ordenarPor: (rascunho) => rascunho.atualizadoEm, celula: (rascunho) => <MomentoRelativo momento={rascunho.atualizadoEm} relogio={relogio} /> },
          { titulo: "Total estimado", numerica: true, ordenarPor: (rascunho) => rascunho.totalEstimado, celula: (rascunho) => <Valor valor={rascunho.totalEstimado} /> },
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
          { titulo: "Pedido", ordenarPor: (pedido) => pedido.numero, celula: (pedido) => <Identificacao titulo={pedido.numero} detalhe={pedido.cliente.nome} /> },
          { titulo: "Emissão", ordenarPor: (pedido) => pedido.emissao, celula: (pedido) => formatarData(pedido.emissao) },
          { titulo: "Entrega", ordenarPor: (pedido) => pedido.entrega, celula: (pedido) => <DataRelativa data={pedido.entrega} hoje={hoje} /> },
          { titulo: "Itens", numerica: true, ordenarPor: (pedido) => pedido.itens, celula: (pedido) => pedido.itens },
          { titulo: "Valor", numerica: true, ordenarPor: (pedido) => pedido.valor, celula: (pedido) => <Valor valor={pedido.valor} /> },
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
          { titulo: "Nota", ordenarPor: (nota) => nota.numero, celula: (nota) => <Identificacao titulo={`NF ${nota.numero}`} detalhe={nota.cliente.nome} /> },
          { titulo: "Emissão", ordenarPor: (nota) => nota.emissao, celula: (nota) => <span title={formatarData(nota.emissao)}>{formatarTempoDesde(nota.emissao, hoje)}</span> },
          { titulo: "Valor", numerica: true, ordenarPor: (nota) => nota.valor, celula: (nota) => <Valor valor={nota.valor} /> },
        ]}
      />
    </CartaoDaAba>
  );
}
