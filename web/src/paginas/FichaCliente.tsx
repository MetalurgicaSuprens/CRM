import { Link, useParams } from "react-router";
import {
  Boxes,
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
import { SituacaoCliente } from "../componentes/SituacaoCliente";
import { TituloDaColuna } from "../componentes/TituloDaColuna";
import { Valor } from "../componentes/Valor";
import { Variacao } from "../componentes/Variacao";
import { Voltar } from "../componentes/Voltar";
import type { ColunaOrdenavel } from "../componentes/ordenacao";
import { useOrdenacao } from "../componentes/useOrdenacao";
import { carregarFicha, carregarSituacaoDosDados } from "../dados/api";
import { ROTULOS_DE_MERCADO, ROTULOS_DE_PORTE } from "../dados/rotulos";
import type { FichaCliente as Ficha, Mercado, PedidoEmAberto, Porte, ProdutoComprado } from "../dados/tipos";
import { useCarga } from "../dados/useCarga";
import { formatarData, formatarNumero, formatarParticipacao, formatarTempoDesde } from "../formato";
import { BarrasHorizontais } from "../graficos/BarrasHorizontais";
import { BarrasMensais } from "../graficos/BarrasMensais";
import { Carregando } from "./Carregando";
import estilos from "./FichaCliente.module.css";


export function FichaCliente() {
  const { codigo = "" } = useParams();
  const { dados: ficha, carregando } = useCarga(`ficha:${codigo}`, () => carregarFicha(codigo));
  const { dados: situacao } = useCarga("situacao", carregarSituacaoDosDados);
  if (carregando || !situacao) return <Carregando />;
  if (!ficha) return <NaoEncontrado />;
  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        antes={<Voltar para="/clientes" rotulo="Clientes" />}
        titulo={ficha.nome}
        selo={<SituacaoCliente situacao={ficha.situacao} tamanho="grande" />}
        descricao={ficha.razaoSocial}
        aoLado={<DadosDoCliente ficha={ficha} />}
        acoes={<NovoPedido codigo={ficha.codigo} />}
      />
      <Indicadores ficha={ficha} hoje={situacao.hoje} />
      <Cartao titulo="Faturamento mensal" icone={ChartNoAxesColumn} subtitulo="Últimos 24 meses e o mês atual">
        <BarrasMensais
          descricao={`Faturamento mensal de ${ficha.nome} nos últimos 24 meses`}
          rotulos={{ valor: "Faturado" }}
          barras={ficha.mensal.map((mes) => ({ mes: mes.mes, valor: mes.valor }))}
          altura={220}
        />
      </Cartao>
      <div className={estilos.gradeDupla}>
        <Cartao titulo="Famílias compradas" icone={Boxes} subtitulo="Últimos 12 meses">
          <BarrasHorizontais
            descricao="Participação de cada família no faturamento dos últimos 12 meses"
            barras={ficha.familias.map((f) => ({ rotulo: f.familia, valor: f.valor, participacao: f.participacao }))}
          />
        </Cartao>
        <Cartao titulo="Oportunidades de mix" icone={Lightbulb} subtitulo="Famílias que clientes parecidos compram e este não">
          <OportunidadesDeMix ficha={ficha} />
        </Cartao>
      </div>
      <Cartao titulo="Produtos mais comprados" icone={Package} subtitulo="Últimos 12 meses">
        <TabelaProdutos ficha={ficha} hoje={situacao.hoje} />
      </Cartao>
      <Cartao titulo="Pedidos em aberto" icone={ClipboardList} subtitulo="Ainda não faturados">
        <TabelaPedidos ficha={ficha} />
      </Cartao>
    </div>
  );
}

function NovoPedido({ codigo }: { codigo: string }) {
  return (
    <Link to={`/pedidos/novo?cliente=${codigo}`} className={`${botoes.primario} ${estilos.novoPedido}`}>
      <FilePlus2 size={19} aria-hidden="true" />
      Novo pedido
    </Link>
  );
}

/** Cadastro do cliente em cartões, à direita do nome. */
function DadosDoCliente({ ficha }: { ficha: Ficha }) {
  return (
    <dl className={estilos.dados}>
      <Dado icone={MapPin} rotulo="Cidade" valor={`${ficha.cidade}/${ficha.uf}`} />
      <Dado icone={Store} rotulo="Mercado" valor={ROTULOS_DE_MERCADO[ficha.mercado]} />
      <Dado icone={Hash} rotulo="Código" valor={ficha.codigo} />
      <Dado icone={Handshake} rotulo="Cliente desde" valor={ficha.primeiraCompra.slice(0, 4)} />
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

function Indicadores({ ficha, hoje }: { ficha: Ficha; hoje: string }) {
  const totalEmAberto = ficha.pedidosEmAberto.reduce((soma, pedido) => soma + pedido.valor, 0);
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
        valor={ficha.pedidosEmAberto.length ? <Valor valor={totalEmAberto} compacto /> : "Nenhum"}
        detalhe={ficha.pedidosEmAberto.length ? `${ficha.pedidosEmAberto.length} pedido(s)` : "tudo faturado"}
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

const COLUNAS_DE_PEDIDOS = {
  pedido: { titulo: "Pedido", ordenarPor: (pedido) => pedido.numero },
  emissao: { titulo: "Emissão", ordenarPor: (pedido) => pedido.emissao },
  entrega: { titulo: "Entrega", ordenarPor: (pedido) => pedido.entrega },
  itens: { titulo: "Itens", numerica: true, ordenarPor: (pedido) => pedido.itens },
  valor: { titulo: "Valor", numerica: true, ordenarPor: (pedido) => pedido.valor },
} satisfies Record<string, ColunaOrdenavel<PedidoEmAberto>>;

function TabelaPedidos({ ficha }: { ficha: Ficha }) {
  const ordenacao = useOrdenacao(ficha.pedidosEmAberto, Object.values(COLUNAS_DE_PEDIDOS), {
    inicial: { coluna: COLUNAS_DE_PEDIDOS.entrega.titulo, sentido: "crescente" },
    parametro: "ordem-pedidos",
  });
  if (ficha.pedidosEmAberto.length === 0) return <p className={estilos.vazio}>Nenhum pedido em aberto.</p>;
  return (
    <div className={estilos.rolagem}>
      <table className={estilos.tabela}>
        <thead>
          <tr>
            <th scope="col">
              <TituloDaColuna coluna={COLUNAS_DE_PEDIDOS.pedido} ordenacao={ordenacao} />
            </th>
            <th scope="col" className={estilos.opcional}>
              <TituloDaColuna coluna={COLUNAS_DE_PEDIDOS.emissao} ordenacao={ordenacao} />
            </th>
            <th scope="col">
              <TituloDaColuna coluna={COLUNAS_DE_PEDIDOS.entrega} ordenacao={ordenacao} />
            </th>
            <th scope="col" className={estilos.numero}>
              <TituloDaColuna coluna={COLUNAS_DE_PEDIDOS.itens} ordenacao={ordenacao} />
            </th>
            <th scope="col" className={estilos.numero}>
              <TituloDaColuna coluna={COLUNAS_DE_PEDIDOS.valor} ordenacao={ordenacao} />
            </th>
          </tr>
        </thead>
        <tbody>
          {ordenacao.ordenados.map((pedido) => (
            <tr key={pedido.numero}>
              <th scope="row">{pedido.numero}</th>
              <td className={estilos.opcional}>{formatarData(pedido.emissao)}</td>
              <td>{formatarData(pedido.entrega)}</td>
              <td className={estilos.numero}>{pedido.itens}</td>
              <td className={estilos.numero}>
                <Valor valor={pedido.valor} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
