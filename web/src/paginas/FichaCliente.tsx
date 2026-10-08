import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  Boxes,
  CalendarCheck,
  ChartNoAxesColumn,
  ClipboardList,
  FilePlus2,
  Lightbulb,
  Package,
  ReceiptText,
  Repeat,
} from "lucide-react";
import { CabecalhoPagina } from "../componentes/CabecalhoPagina";
import { Cartao } from "../componentes/Cartao";
import { Indicador } from "../componentes/Indicador";
import { SituacaoCliente } from "../componentes/SituacaoCliente";
import { Valor } from "../componentes/Valor";
import { Variacao } from "../componentes/Variacao";
import { carregarFicha, carregarSituacaoDosDados } from "../dados/api";
import type { FichaCliente as Ficha, Mercado, Porte } from "../dados/tipos";
import { useCarga } from "../dados/useCarga";
import { formatarData, formatarNumero, formatarParticipacao, formatarTempoDesde } from "../formato";
import { BarrasHorizontais } from "../graficos/BarrasHorizontais";
import { BarrasMensais } from "../graficos/BarrasMensais";
import { Carregando } from "./Carregando";
import estilos from "./FichaCliente.module.css";

const MERCADOS: Record<Mercado, string> = { PRACA: "Praça", MONTADORA: "Montadora", EXPORTACAO: "Exportação" };
const PORTES: Record<Porte, string> = { pequeno: "pequeno", medio: "médio", grande: "grande" };

export function FichaCliente() {
  const { codigo = "" } = useParams();
  const { dados: ficha, carregando } = useCarga(`ficha:${codigo}`, () => carregarFicha(codigo));
  const { dados: situacao } = useCarga("situacao", carregarSituacaoDosDados);
  if (carregando || !situacao) return <Carregando />;
  if (!ficha) return <NaoEncontrado />;
  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        antes={<Voltar />}
        titulo={ficha.nome}
        descricao={
          <span className={estilos.identificacao}>
            <span>{ficha.razaoSocial}</span>
            <span>
              {ficha.cidade}/{ficha.uf} · {MERCADOS[ficha.mercado]} · código {ficha.codigo} · cliente desde {ficha.primeiraCompra.slice(0, 4)}
            </span>
          </span>
        }
        acoes={
          <>
            <SituacaoCliente situacao={ficha.situacao} />
            <Link to={`/pedidos?cliente=${ficha.codigo}`} className={estilos.botaoPrincipal}>
              <FilePlus2 size={16} aria-hidden="true" />
              Novo pedido
            </Link>
          </>
        }
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

function Indicadores({ ficha, hoje }: { ficha: Ficha; hoje: string }) {
  const totalEmAberto = ficha.pedidosEmAberto.reduce((soma, pedido) => soma + pedido.valor, 0);
  return (
    <div className={estilos.indicadores}>
      <Indicador
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
  const faixa = porte ? `, porte ${PORTES[porte]}` : "";
  return `Parecidos: clientes ativos do mercado ${MERCADOS[mercado]}${faixa}, em toda a Suprens.`;
}

function TabelaProdutos({ ficha, hoje }: { ficha: Ficha; hoje: string }) {
  if (ficha.produtos.length === 0) return <p className={estilos.vazio}>Sem compras nos últimos 12 meses.</p>;
  return (
    <div className={estilos.rolagem}>
      <table className={estilos.tabela}>
        <thead>
          <tr>
            <th scope="col">Produto</th>
            <th scope="col" className={estilos.opcional}>Família</th>
            <th scope="col" className={estilos.opcional}>Última compra</th>
            <th scope="col" className={estilos.numero}>Peças</th>
            <th scope="col" className={estilos.numero}>Valor</th>
          </tr>
        </thead>
        <tbody>
          {ficha.produtos.map((produto) => (
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

function TabelaPedidos({ ficha }: { ficha: Ficha }) {
  if (ficha.pedidosEmAberto.length === 0) return <p className={estilos.vazio}>Nenhum pedido em aberto.</p>;
  return (
    <div className={estilos.rolagem}>
      <table className={estilos.tabela}>
        <thead>
          <tr>
            <th scope="col">Pedido</th>
            <th scope="col" className={estilos.opcional}>Emissão</th>
            <th scope="col">Entrega</th>
            <th scope="col" className={estilos.numero}>Itens</th>
            <th scope="col" className={estilos.numero}>Valor</th>
          </tr>
        </thead>
        <tbody>
          {ficha.pedidosEmAberto.map((pedido) => (
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

function Voltar() {
  return (
    <Link to="/clientes" className={estilos.voltar}>
      <ArrowLeft size={15} aria-hidden="true" />
      Clientes
    </Link>
  );
}

function NaoEncontrado() {
  return (
    <div className={estilos.pagina}>
      <Voltar />
      <p className={estilos.vazio}>Cliente não encontrado na sua carteira.</p>
    </div>
  );
}
