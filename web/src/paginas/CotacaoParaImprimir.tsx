import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router";
import { Printer } from "lucide-react";
import { dataDoMomento, somarDias } from "dominio/datas";
import { primeiraEntregaPossivel, valorDaLinha } from "dominio/pedido";
import botoes from "../componentes/Botao.module.css";
import { CabecalhoPagina } from "../componentes/CabecalhoPagina";
import { Voltar } from "../componentes/Voltar";
import { carregarCatalogo, carregarCotacao, carregarSituacaoDosDados } from "../dados/api";
import { ROTULOS_DA_CLASSIFICACAO, nomeDaTransportadora, totaisDoPedido, valorDoIpi } from "../dados/dadosDoPedido";
import type { CatalogoDoCliente, Cotacao } from "../dados/tipos";
import { useCarga } from "../dados/useCarga";
import { formatarComCentavos, formatarData, formatarDocumentoDoCliente, formatarEnderecoDoCadastro, formatarNumero, formatarReaisComCentavos } from "../formato";
import { Carregando } from "./Carregando";
import estilos from "./CotacaoParaImprimir.module.css";

/*
 * A cotação formalizada para o cliente (pedido do Lucas em 2026-11-23): a página que o navegador
 * imprime ou salva em PDF ("Salvar como PDF"), no computador e no celular, sem programa novo. O menu e a
 * barra somem na impressão (Layout.module.css). Os valores aparecem mesmo com "Ocultar valores": a
 * cotação é para o cliente ver. Sem contato do representante, como o Lucas decidiu.
 */

/** A validade da cotação: a mesma que o app antigo dos representantes grava no SGI (V_DVA = hoje + 10). */
export const DIAS_DE_VALIDADE_DA_COTACAO = 10;

export function CotacaoParaImprimir() {
  const { id = "" } = useParams();
  const [busca, setBusca] = useState<{ id: string; cotacao: Cotacao | null } | null>(null);
  useEffect(() => {
    let atual = true;
    carregarCotacao(id).then(
      (cotacao) => atual && setBusca({ id, cotacao }),
      () => atual && setBusca({ id, cotacao: null }),
    );
    return () => {
      atual = false;
    };
  }, [id]);
  if (busca?.id !== id) return <Carregando />;
  if (!busca.cotacao) return <p className={estilos.aviso}>Cotação não encontrada: ela foi enviada ou descartada.</p>;
  return <ComCatalogo cotacao={busca.cotacao} />;
}

function ComCatalogo({ cotacao }: { cotacao: Cotacao }) {
  const codigo = cotacao.cliente.codigo;
  const { dados: catalogo, carregando } = useCarga(`catalogo:${codigo}`, () => carregarCatalogo(codigo));
  const { dados: situacao } = useCarga("situacao", carregarSituacaoDosDados);
  if (carregando || !situacao) return <Carregando />;
  if (!catalogo) return <p className={estilos.aviso}>O cliente desta cotação não está mais na sua carteira.</p>;
  return (
    <>
      <div className={estilos.naTela}>
        <CabecalhoPagina
          antes={<Voltar para={`/pedidos/cotacoes/${cotacao.id}`} rotulo="Cotação" />}
          titulo="Cotação em PDF"
          acoes={
            <button type="button" className={`${botoes.primario} ${estilos.imprimir}`} onClick={() => window.print()}>
              <Printer size={18} aria-hidden="true" />
              Imprimir ou salvar em PDF
            </button>
          }
        />
        <p className={estilos.dica}>Na janela de impressão, escolha "Salvar como PDF" para mandar o arquivo ao cliente.</p>
      </div>
      <Folha cotacao={cotacao} catalogo={catalogo} representante={situacao.representante.nome} hoje={dataDoMomento(situacao.relogio)} />
    </>
  );
}

type PropsDaFolha = { cotacao: Cotacao; catalogo: CatalogoDoCliente; representante: string; hoje: string };

/** A folha A4: a Suprens e a cotação, o cliente, os itens, as condições e os totais. */
function Folha({ cotacao, catalogo, representante, hoje }: PropsDaFolha) {
  const dados = catalogo.dadosDoPedido;
  const emitidaEm = dataDoMomento(cotacao.atualizadoEm);
  return (
    <article className={estilos.folha} aria-label="Cotação para imprimir">
      <header className={estilos.topo}>
        <img src="/marca/suprens-96.png" alt="Suprens" width={64} height={61} />
        <div className={estilos.titulo}>
          <h2>Cotação</h2>
          <p>
            Emitida em {formatarData(emitidaEm)} · válida até {formatarData(somarDias(emitidaEm, DIAS_DE_VALIDADE_DA_COTACAO))}
          </p>
        </div>
      </header>

      <section className={estilos.bloco}>
        <h3>Cliente</h3>
        <p className={estilos.destaque}>{dados?.cadastro.razaoSocial ?? catalogo.cliente.nome}</p>
        <p>{formatarDocumentoDoCliente(catalogo.cliente)}</p>
        {dados ? <p>{formatarEnderecoDoCadastro(dados.cadastro.faturamento)}</p> : null}
      </section>

      <ItensDaCotacao cotacao={cotacao} catalogo={catalogo} />

      <section className={`${estilos.bloco} ${estilos.condicoes}`}>
        <h3>Condições</h3>
        <dl>
          <CondicoesDaCotacao cotacao={cotacao} catalogo={catalogo} hoje={hoje} />
        </dl>
      </section>

      {cotacao.observacao.trim() ? (
        <section className={estilos.bloco}>
          <h3>Observações</h3>
          <p className={estilos.observacao}>{cotacao.observacao}</p>
        </section>
      ) : null}

      <footer className={estilos.rodape}>Representante: {representante}</footer>
    </article>
  );
}

function ItensDaCotacao({ cotacao, catalogo }: { cotacao: Cotacao; catalogo: CatalogoDoCliente }) {
  const ipi = catalogo.dadosDoPedido?.ipi ?? null;
  const totais = totaisDoPedido(cotacao.itens, ipi);
  const temOrdem = cotacao.itens.some((item) => item.ordemDeCompra !== null || item.itemDaOrdemDeCompra !== null) || cotacao.escolhas?.pedidoDoCliente;
  const ordemDoPedido = cotacao.escolhas?.pedidoDoCliente.trim() ?? "";
  return (
    <table className={estilos.itens}>
      <thead>
        <tr>
          <th>Item</th>
          <th>Produto</th>
          {temOrdem ? (
            <>
              <th>Ordem compra</th>
              <th className={estilos.numero}>Item OC</th>
            </>
          ) : null}
          <th className={estilos.numero}>Qtde (pç)</th>
          <th className={estilos.numero}>Cento R$</th>
          <th className={estilos.numero}>Valor s/ IPI</th>
          {ipi ? (
            <>
              <th className={estilos.numero}>IPI</th>
              <th className={estilos.numero}>Valor c/ IPI</th>
            </>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {cotacao.itens.map((item, posicao) => {
          const semIpi = valorDaLinha(item);
          const valorIpi = ipi ? valorDoIpi(item, ipi) : 0;
          return (
            <tr key={item.codigo}>
              <td>{posicao + 1}</td>
              <td>
                <span className={estilos.codigo}>{item.codigo}</span>
              </td>
              {temOrdem ? (
                <>
                  <td>{item.ordemDeCompra ?? ordemDoPedido}</td>
                  <td className={estilos.numero}>{item.itemDaOrdemDeCompra ?? ""}</td>
                </>
              ) : null}
              <td className={estilos.numero}>{formatarNumero(item.quantidade)}</td>
              <td className={estilos.numero}>{formatarComCentavos(item.precoCento)}</td>
              <td className={estilos.numero}>{formatarComCentavos(semIpi)}</td>
              {ipi ? (
                <>
                  <td className={estilos.numero}>{formatarComCentavos(valorIpi)}</td>
                  <td className={estilos.numero}>{formatarComCentavos(semIpi + valorIpi)}</td>
                </>
              ) : null}
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={temOrdem ? 4 : 2}>
            Total · {formatarNumero(totais.itens)} {totais.itens === 1 ? "item" : "itens"}
          </td>
          <td className={estilos.numero}>{formatarNumero(totais.pecas)}</td>
          <td />
          <td className={estilos.numero}>{formatarReaisComCentavos(totais.semIpi)}</td>
          {ipi && totais.ipi !== null && totais.comIpi !== null ? (
            <>
              <td className={estilos.numero}>{formatarReaisComCentavos(totais.ipi)}</td>
              <td className={estilos.numero}>{formatarReaisComCentavos(totais.comIpi)}</td>
            </>
          ) : null}
        </tr>
      </tfoot>
    </table>
  );
}

function CondicoesDaCotacao({ cotacao, catalogo, hoje }: { cotacao: Cotacao; catalogo: CatalogoDoCliente; hoje: string }) {
  const dados = catalogo.dadosDoPedido;
  const escolhas = cotacao.escolhas;
  const entrega = cotacao.entrega ? `Programada para ${formatarData(cotacao.entrega)}` : `Assim que possível, a partir de ${formatarData(primeiraEntregaPossivel(hoje))}`;
  return (
    <>
      <Condicao rotulo="Entrega">{entrega}</Condicao>
      {dados && escolhas ? (
        <>
          <Condicao rotulo="Pagamento">{dados.condicoes.find((condicao) => condicao.codigo === escolhas.condicaoDePagamento)?.descricao ?? escolhas.condicaoDePagamento}</Condicao>
          <Condicao rotulo="Transportadora">{escolhas.transportadora ? nomeDaTransportadora(dados, escolhas.transportadora) : "A combinar"}</Condicao>
          <Condicao rotulo="Frete parcial">{escolhas.aceitaParcial ? "Aceita" : "Não aceita"}</Condicao>
          <Condicao rotulo="Venda">{ROTULOS_DA_CLASSIFICACAO[escolhas.classificacao]}</Condicao>
          {escolhas.pedidoDoCliente.trim() ? <Condicao rotulo="Ordem de compra">{escolhas.pedidoDoCliente}</Condicao> : null}
        </>
      ) : null}
      <Condicao rotulo="Preços">Em reais, por cento de peças</Condicao>
    </>
  );
}

function Condicao({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt>{rotulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}
