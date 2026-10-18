import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import {
  Boxes,
  Building2,
  CalendarCheck,
  ChartNoAxesColumn,
  ClipboardList,
  FilePlus2,
  Handshake,
  Hash,
  Lightbulb,
  MapPin,
  Package,
  ReceiptText,
  Repeat,
  Store,
  type LucideIcon,
} from "lucide-react";
import botoes from "../componentes/Botao.module.css";
import { CabecalhoPagina } from "../componentes/CabecalhoPagina";
import { Cartao } from "../componentes/Cartao";
import { Indicador } from "../componentes/Indicador";
import { SeloDoGrupo } from "../componentes/NomeDoCliente";
import { rotuloDaTela, useOrigem } from "../componentes/navegacao";
import { MotivoDoRisco, SITUACOES, SituacaoCliente } from "../componentes/SituacaoCliente";
import { AvisoDePedidoBloqueado, SeloDoStatus } from "../componentes/StatusDoCliente";
import { STATUS_DO_PEDIDO, SeloDoPedido } from "../componentes/StatusDoPedido";
import { Identificacao, TabelaResponsiva } from "../componentes/TabelaResponsiva";
import { TituloDaColuna } from "../componentes/TituloDaColuna";
import { Valor } from "../componentes/Valor";
import { Variacao } from "../componentes/Variacao";
import { Voltar, VoltarAoAnterior } from "../componentes/Voltar";
import type { ColunaOrdenavel } from "../componentes/ordenacao";
import { useOrdenacao } from "../componentes/useOrdenacao";
import { AVISO_DE_PEDIDO_BLOQUEADO, podeReceberPedido } from "dominio/statusDoCadastro";
import { carregarFicha, carregarSituacaoDosDados } from "../dados/api";
import { ROTULOS_DE_MERCADO, ROTULOS_DE_PORTE } from "../dados/rotulos";
import { aFaturarNoMes, montarMesAMes, resumirOAno, type ResumoDoAno } from "../dados/faturamentoDoCliente";
import type { ClienteResumo, FichaCliente as Ficha, Mercado, Porte, ProdutoComprado, Semestre } from "../dados/tipos";
import { useCarga } from "../dados/useCarga";
import {
  formatarCodigoDoCliente,
  formatarContagem,
  formatarData,
  formatarLocalECodigo,
  formatarNomeDoMes,
  formatarNumero,
  formatarParticipacao,
  formatarTempoDesde,
} from "../formato";
import { BarrasHorizontais } from "../graficos/BarrasHorizontais";
import { BarrasMensais } from "../graficos/BarrasMensais";
import { Carregando } from "./Carregando";
import { DetalheDoPedidoDaFicha } from "./DetalhesDosPedidos";
import estilos from "./FichaCliente.module.css";
import { TendenciaDaFicha } from "./TendenciaDaFicha";


export function FichaCliente() {
  const { codigo = "" } = useParams();
  const { dados: ficha, carregando } = useCarga(`ficha:${codigo}`, () => carregarFicha(codigo));
  const { dados: situacao } = useCarga("situacao", carregarSituacaoDosDados);
  // Guarda de qual cliente é o aviso: ao abrir a ficha de outro, ele some.
  const [codigoDoAviso, setCodigoDoAviso] = useState<string | null>(null);
  if (carregando || !situacao) return <Carregando />;
  if (!ficha) return <NaoEncontrado />;
  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        antes={<VoltarDaFicha ficha={ficha} />}
        titulo={ficha.nome}
        selo={
          <>
            {ficha.cnpjs ? <SeloDoGrupo tamanho="grande" /> : null}
            <SituacaoCliente situacao={ficha.situacao} tamanho="grande" />
            <SeloDoStatus status={ficha.status} tamanho="grande" />
          </>
        }
        descricao={descricaoDaFicha(ficha, situacao.semestre)}
        aoLado={<DadosDoCliente ficha={ficha} />}
        acoes={<NovoPedido ficha={ficha} aoBloquear={() => setCodigoDoAviso(ficha.codigo)} />}
      />
      {codigoDoAviso === ficha.codigo && !podeReceberPedido(ficha.status) ? (
        <AvisoDePedidoBloqueado texto={AVISO_DE_PEDIDO_BLOQUEADO[ficha.status]} />
      ) : null}
      <Indicadores ficha={ficha} hoje={situacao.hoje} />
      <Faturamento ficha={ficha} hoje={situacao.hoje} />
      {ficha.cnpjs ? (
        <Cartao titulo="Por CNPJ" icone={Building2} subtitulo="Os números de cada CNPJ do grupo; a linha abre a ficha dele">
          <TabelaDosCnpjs cnpjs={ficha.cnpjs} faturamentoDoGrupo={ficha.faturamento12m} hoje={situacao.hoje} />
        </Cartao>
      ) : null}
      <div className={estilos.gradeDupla}>
        <Cartao titulo="Famílias compradas" icone={Boxes} subtitulo="Últimos 12 meses">
          <BarrasHorizontais
            descricao="Participação de cada família no faturamento dos últimos 12 meses, com as peças"
            tituloDoRotulo="Família"
            barras={ficha.familias.map((f) => ({ rotulo: f.familia, valor: f.valor, participacao: f.participacao, pecas: f.pecas }))}
          />
        </Cartao>
        <Cartao titulo="Oportunidades de mix" icone={Lightbulb} subtitulo="Famílias que clientes parecidos compram e este não">
          <OportunidadesDeMix ficha={ficha} />
        </Cartao>
      </div>
      <Cartao titulo="Produtos mais comprados" icone={Package} subtitulo="Últimos 12 meses">
        <TabelaProdutos ficha={ficha} hoje={situacao.hoje} />
      </Cartao>
      <Cartao titulo="Pedidos" icone={ClipboardList} subtitulo="Últimos 12 meses e o mês atual, e todos os em aberto">
        <TabelaPedidos ficha={ficha} hoje={situacao.hoje} />
      </Cartao>
    </div>
  );
}

/**
 * O faturamento em dois gráficos, cada um com uma pergunta: a tendência (o cliente compra mais, menos
 * ou igual nos últimos 4 anos?) e o mês a mês do ano contra o anterior (em que meses ele compra, e como
 * está indo?), no mesmo desenho do Início.
 */
function Faturamento({ ficha, hoje }: { ficha: Ficha; hoje: string }) {
  const mesAtual = hoje.slice(0, 7);
  const ano = Number(mesAtual.slice(0, 4));
  const resumo = resumirOAno(ficha.mensal, mesAtual);
  return (
    <div className={estilos.gradeDosGraficos}>
      <TendenciaDaFicha ficha={ficha} mesAtual={mesAtual} />
      <Cartao titulo="Mês a mês" icone={ChartNoAxesColumn} subtitulo={`${ano}, comparado a ${ano - 1}`}>
        {resumo ? <AnoAteAgora resumo={resumo} /> : null}
        <BarrasMensais
          descricao={`Faturamento mensal de ${ficha.nome} em ${ano}, comparado a ${ano - 1}`}
          rotulos={{ valor: String(ano), comparacao: String(ano - 1), aFaturar: "A faturar no mês" }}
          barras={montarMesAMes(ficha.mensal, mesAtual, aFaturarNoMes(ficha.pedidos, mesAtual))}
          altura={220}
        />
      </Cartao>
    </div>
  );
}

/** "2026 até setembro: R$ 412 mil, +12% vs o mesmo período de 2025": o ano até o último mês fechado. */
function AnoAteAgora({ resumo }: { resumo: ResumoDoAno }) {
  const ano = Number(resumo.inicio.slice(0, 4));
  const variacao = resumo.anoAnterior > 0 ? resumo.valor / resumo.anoAnterior - 1 : null;
  return (
    <p className={estilos.resumoDoGrafico}>
      <span>
        {ano} até {formatarNomeDoMes(resumo.fim)}: <Valor valor={resumo.valor} compacto />
      </span>
      <Variacao razao={variacao} referencia={`vs o mesmo período de ${ano - 1}`} />
    </p>
  );
}

/**
 * Volta para a tela de onde se veio, como ela estava: a análise na mesma aba e na mesma altura, ou o
 * grupo do CNPJ. Sem origem conhecida (a ficha aberta direto ou recarregada), vai para o grupo ou
 * para Clientes.
 */
function VoltarDaFicha({ ficha }: { ficha: Ficha }) {
  const origem = useOrigem();
  const rotulo = origem ? rotuloDaOrigem(origem.pathname, ficha) : null;
  if (rotulo) return <VoltarAoAnterior rotulo={rotulo} />;
  if (ficha.grupo) return <Voltar para={`/clientes/${ficha.grupo.codigo}`} rotulo={ficha.grupo.nome} />;
  return <Voltar para="/clientes" rotulo="Clientes" />;
}

/** O nome da tela de origem: uma do menu ou, no CNPJ, a ficha do grupo dele. */
function rotuloDaOrigem(caminho: string, ficha: Ficha): string | null {
  if (ficha.grupo && caminho === `/clientes/${ficha.grupo.codigo}`) return ficha.grupo.nome;
  return rotuloDaTela(caminho);
}

/** No cliente fora de ativo no cadastro, o botão continua, mas mostra o aviso no lugar de abrir o pedido. */
function NovoPedido({ ficha, aoBloquear }: { ficha: Ficha; aoBloquear: () => void }) {
  const classe = `${botoes.primario} ${estilos.novoPedido}`;
  const rotulo = (
    <>
      <FilePlus2 size={19} aria-hidden="true" />
      Novo pedido
    </>
  );
  if (!podeReceberPedido(ficha.status)) {
    return (
      <button type="button" className={classe} onClick={aoBloquear}>
        {rotulo}
      </button>
    );
  }
  // O pedido é sempre de um CNPJ: no grupo, o botão leva à escolha entre os CNPJs dele.
  return (
    <Link to={ficha.cnpjs ? `/pedidos/novo?grupo=${ficha.codigo}` : `/pedidos/novo?cliente=${ficha.codigo}`} className={classe}>
      {rotulo}
    </Link>
  );
}

/** Cadastro do cliente em cartões, à direita do nome. O grupo não tem cidade nem código: mostra quantos CNPJs e municípios. */
function DadosDoCliente({ ficha }: { ficha: Ficha }) {
  const { cnpjs } = ficha;
  return (
    <dl className={estilos.dados}>
      {cnpjs ? (
        <>
          <Dado icone={Building2} rotulo="CNPJs" valor={formatarNumero(cnpjs.length)} />
          <Dado icone={MapPin} rotulo="Municípios" valor={formatarNumero(new Set(cnpjs.map(({ cidade, uf }) => `${cidade}/${uf}`)).size)} />
        </>
      ) : (
        <Dado icone={MapPin} rotulo="Cidade" valor={`${ficha.cidade}/${ficha.uf}`} />
      )}
      <Dado icone={Store} rotulo="Mercado" valor={ROTULOS_DE_MERCADO[ficha.mercado]} />
      {cnpjs ? null : <Dado icone={Hash} rotulo="Código" valor={formatarCodigoDoCliente(ficha.codigoErp)} />}
      <Dado icone={Handshake} rotulo="Cliente desde" valor={ficha.clienteDesde === null ? "—" : String(ficha.clienteDesde)} />
    </dl>
  );
}

function Dado({ icone: Icone, rotulo, valor }: { icone: LucideIcon; rotulo: string; valor: string }) {
  return (
    <div className={estilos.dado}>
      <dt className={estilos.rotuloDado}>
        <Icone size={14} strokeWidth={1.75} aria-hidden="true" />
        {rotulo}
      </dt>
      <dd className={estilos.valorDado}>{valor}</dd>
    </div>
  );
}

/**
 * Embaixo do nome: o que é o grupo ou de que grupo é o CNPJ, a razão social, quando é outra, e o
 * motivo do selo "Em risco". O motivo não vai ao lado do selo porque alargaria a linha do título,
 * que empurraria o cadastro ao lado.
 */
function descricaoDaFicha(ficha: Ficha, semestre: Semestre): ReactNode {
  const razaoSocial = ficha.razaoSocial && ficha.razaoSocial !== ficha.nome ? ficha.razaoSocial : null;
  const grupo = descricaoDoGrupo(ficha);
  if (!grupo && !razaoSocial && ficha.quedaNoSemestre === null) return undefined;
  return (
    <span className={estilos.descricao}>
      {grupo ? <span>{grupo}</span> : null}
      {razaoSocial ? <span>{razaoSocial}</span> : null}
      <MotivoDoRisco queda={ficha.quedaNoSemestre} semestre={semestre} />
    </span>
  );
}

/** No grupo, o que ele é; no CNPJ de um grupo, de que grupo ele é. */
function descricaoDoGrupo(ficha: Ficha): string | null {
  if (ficha.cnpjs) return `Grupo do cadastro do SGI: ${formatarContagem(ficha.cnpjs.length, "CNPJ", "CNPJs")}, com os números somados`;
  return ficha.grupo ? `CNPJ do grupo ${ficha.grupo.nome}` : null;
}

function Indicadores({ ficha, hoje }: { ficha: Ficha; hoje: string }) {
  const emAberto = ficha.pedidos.filter((pedido) => pedido.status === "em_aberto");
  const totalEmAberto = emAberto.reduce((soma, pedido) => soma + pedido.valor, 0);
  return (
    <div className={estilos.indicadores}>
      <Indicador
        destaque
        rotulo="Faturado em 12 meses"
        icone={ReceiptText}
        valor={<Valor valor={ficha.faturamento12m} compacto />}
        detalhe={<Variacao razao={ficha.variacao12m} referencia="vs 12 meses anteriores" />}
      />
      <Indicador
        rotulo="Última compra"
        icone={CalendarCheck}
        valor={ficha.ultimaCompra ? formatarTempoDesde(ficha.ultimaCompra, hoje) : "—"}
        detalhe={ficha.ultimaCompra ? `em ${formatarData(ficha.ultimaCompra)}` : "sem compras"}
      />
      <Indicador
        rotulo="Ciclo de compra"
        icone={Repeat}
        valor={ficha.cicloDias ? `${ficha.cicloDias} dias` : "Irregular"}
        detalhe={ficha.cicloDias ? "intervalo típico entre compras" : "poucas compras para estimar"}
      />
      <Indicador
        rotulo="Pedidos em aberto"
        icone={ClipboardList}
        valor={emAberto.length ? <Valor valor={totalEmAberto} compacto /> : "Nenhum"}
        detalhe={emAberto.length ? `${emAberto.length} pedido(s)` : "tudo faturado"}
      />
    </div>
  );
}

function OportunidadesDeMix({ ficha }: { ficha: Ficha }) {
  if (!ficha.grupoDoMix) return <p className={estilos.vazio}>Poucos clientes parecidos para comparar.</p>;
  return (
    <>
      {ficha.oportunidades.length === 0 ? (
        <p className={estilos.vazio}>Este cliente já compra as famílias mais comuns entre os parecidos.</p>
      ) : (
        <ul className={estilos.oportunidades}>
          {ficha.oportunidades.map((oportunidade) => (
            <li key={oportunidade.familia}>
              <span className={estilos.familia}>{oportunidade.familia}</span>
              <span className={estilos.penetracao}>
                {formatarParticipacao(oportunidade.penetracao)} dos clientes parecidos compram
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className={estilos.notaMix}>{descreverParecidos(ficha.mercado, ficha.grupoDoMix.porte)}</p>
    </>
  );
}

function descreverParecidos(mercado: Mercado, porte: Porte | null): string {
  const faixa = porte ? `, porte ${ROTULOS_DE_PORTE[porte]}` : "";
  return `Parecidos: clientes ativos do mercado ${ROTULOS_DE_MERCADO[mercado]}${faixa}, em toda a Suprens.`;
}

const COLUNAS_DE_PRODUTOS = {
  produto: { titulo: "Produto", ordenarPor: (produto) => produto.codigo },
  familia: { titulo: "Família", ordenarPor: (produto) => produto.familia },
  ultimaCompra: { titulo: "Última compra", ordenarPor: (produto) => produto.ultimaCompra },
  pecas: { titulo: "Peças", numerica: true, ordenarPor: (produto) => produto.pecas },
  valor: { titulo: "Valor", numerica: true, ordenarPor: (produto) => produto.valor },
} satisfies Record<string, ColunaOrdenavel<ProdutoComprado>>;

function TabelaProdutos({ ficha, hoje }: { ficha: Ficha; hoje: string }) {
  const ordenacao = useOrdenacao(ficha.produtos, Object.values(COLUNAS_DE_PRODUTOS), {
    inicial: { coluna: COLUNAS_DE_PRODUTOS.valor.titulo, sentido: "decrescente" },
    parametro: "ordem-produtos",
  });
  if (ficha.produtos.length === 0) return <p className={estilos.vazio}>Sem compras nos últimos 12 meses.</p>;
  return (
    <div className={estilos.rolagem}>
      <table className={estilos.tabela}>
        <thead>
          <tr>
            <th scope="col">
              <TituloDaColuna coluna={COLUNAS_DE_PRODUTOS.produto} ordenacao={ordenacao} />
            </th>
            <th scope="col" className={estilos.opcional}>
              <TituloDaColuna coluna={COLUNAS_DE_PRODUTOS.familia} ordenacao={ordenacao} />
            </th>
            <th scope="col" className={estilos.opcional}>
              <TituloDaColuna coluna={COLUNAS_DE_PRODUTOS.ultimaCompra} ordenacao={ordenacao} />
            </th>
            <th scope="col" className={estilos.numero}>
              <TituloDaColuna coluna={COLUNAS_DE_PRODUTOS.pecas} ordenacao={ordenacao} />
            </th>
            <th scope="col" className={estilos.numero}>
              <TituloDaColuna coluna={COLUNAS_DE_PRODUTOS.valor} ordenacao={ordenacao} />
            </th>
          </tr>
        </thead>
        <tbody>
          {ordenacao.ordenados.map((produto) => (
            <tr key={produto.codigo}>
              <th scope="row">{produto.codigo}</th>
              <td className={estilos.opcional}>{produto.familia}</td>
              <td className={estilos.opcional}>{formatarTempoDesde(produto.ultimaCompra, hoje)}</td>
              <td className={estilos.numero}>{formatarNumero(produto.pecas)}</td>
              <td className={estilos.numero}>
                <Valor valor={produto.valor} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** O histórico de pedidos do cliente; a linha abre o resumo por família e os itens, como em Pedidos. */
function TabelaPedidos({ ficha, hoje }: { ficha: Ficha; hoje: string }) {
  return (
    <TabelaResponsiva
      descricao={`Pedidos de ${ficha.nome}`}
      itens={ficha.pedidos}
      chaveDe={(pedido) => pedido.id}
      detalheDe={(pedido) => <DetalheDoPedidoDaFicha pedido={pedido} hoje={hoje} />}
      vazio="Nenhum pedido nos últimos 12 meses."
      ordemInicial={{ coluna: "Emissão", sentido: "decrescente" }}
      parametroDaOrdem="ordem-pedidos"
      colunas={[
        // Na ficha do grupo, cada pedido diz de que CNPJ é.
        { titulo: "Pedido", ordenarPor: (pedido) => pedido.numero, celula: (pedido) => <Identificacao titulo={pedido.numero ?? "—"} detalhe={pedido.cnpj?.nome ?? null} /> },
        { titulo: "Status", largura: 9, ordenarPor: (pedido) => STATUS_DO_PEDIDO[pedido.status].rotulo, celula: (pedido) => <SeloDoPedido status={pedido.status} /> },
        { titulo: "Emissão", ordenarPor: (pedido) => pedido.emissao, celula: (pedido) => formatarData(pedido.emissao) },
        { titulo: "Entrega", ordenarPor: (pedido) => pedido.entrega, celula: (pedido) => (pedido.entrega ? formatarData(pedido.entrega) : "—") },
        { titulo: "Itens", numerica: true, largura: 4.5, ordenarPor: (pedido) => pedido.itens.length, celula: (pedido) => pedido.itens.length },
        { titulo: "Valor", numerica: true, ordenarPor: (pedido) => pedido.valor, celula: (pedido) => <Valor valor={pedido.valor} /> },
      ]}
    />
  );
}

/** A análise por CNPJ do grupo: os números de cada um e a parte dele no faturado do grupo. */
function TabelaDosCnpjs({ cnpjs, faturamentoDoGrupo, hoje }: { cnpjs: ClienteResumo[]; faturamentoDoGrupo: number; hoje: string }) {
  const parteDe = (cnpj: ClienteResumo) => (faturamentoDoGrupo > 0 ? cnpj.faturamento12m / faturamentoDoGrupo : 0);
  return (
    <TabelaResponsiva
      descricao="CNPJs do grupo"
      itens={cnpjs}
      chaveDe={(cnpj) => cnpj.codigo}
      linkDe={(cnpj) => `/clientes/${cnpj.codigo}`}
      vazio="Nenhum CNPJ do grupo na sua carteira."
      ordemInicial={{ coluna: "Faturado 12 meses", sentido: "decrescente" }}
      parametroDaOrdem="ordem-cnpjs"
      colunas={[
        { titulo: "CNPJ", ordenarPor: (cnpj) => cnpj.nome, celula: (cnpj) => <Identificacao titulo={cnpj.nome} detalhe={formatarLocalECodigo(cnpj)} /> },
        { titulo: "Situação", ordenarPor: (cnpj) => SITUACOES[cnpj.situacao].rotulo, celula: (cnpj) => <SituacaoCliente situacao={cnpj.situacao} /> },
        {
          titulo: "Última compra",
          ordenarPor: (cnpj) => cnpj.ultimaCompra,
          celula: (cnpj) => (cnpj.ultimaCompra ? formatarTempoDesde(cnpj.ultimaCompra, hoje) : "sem compras"),
        },
        { titulo: "Faturado 12 meses", numerica: true, ordenarPor: (cnpj) => cnpj.faturamento12m, celula: (cnpj) => <Valor valor={cnpj.faturamento12m} /> },
        { titulo: "Parte", numerica: true, largura: 5, ordenarPor: parteDe, celula: (cnpj) => formatarParticipacao(parteDe(cnpj)) },
        { titulo: "Variação", numerica: true, ordenarPor: (cnpj) => cnpj.variacao12m, celula: (cnpj) => <Variacao razao={cnpj.variacao12m} /> },
      ]}
    />
  );
}

function NaoEncontrado() {
  return (
    <div className={estilos.pagina}>
      <Voltar para="/clientes" rotulo="Clientes" />
      <p className={estilos.vazio}>Cliente não encontrado na sua carteira.</p>
    </div>
  );
}
