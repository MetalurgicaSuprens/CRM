import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useParams } from "react-router";
import { ListOrdered, Package, Printer, Weight, type LucideIcon } from "lucide-react";
import { dataDoMomento, horaDoMomento, somarDias } from "dominio/datas";
import { primeiraEntregaPossivel, valorDaLinha } from "dominio/pedido";
import botoes from "../componentes/Botao.module.css";
import { CabecalhoPagina } from "../componentes/CabecalhoPagina";
import { Voltar } from "../componentes/Voltar";
import { carregarCatalogo, carregarCotacao, carregarSituacaoDosDados } from "../dados/api";
import { ROTULOS_DA_CLASSIFICACAO, aliquotaDoIpi, formatarCnpj, pesoDosItens, totaisDoPedido, transportadoraDe, valorDoIpi, type TotaisDoPedido } from "../dados/dadosDoPedido";
import type { CatalogoDoCliente, Cotacao, LocalDoCadastro } from "../dados/tipos";
import { useCarga } from "../dados/useCarga";
import {
  formatarAliquota,
  formatarCep,
  formatarComCentavos,
  formatarContagem,
  formatarData,
  formatarDocumentoDoCliente,
  formatarNumero,
  formatarPeso,
  formatarReaisComCentavos,
} from "../formato";
import { Carregando } from "./Carregando";
import estilos from "./CotacaoParaImprimir.module.css";
import { paginarCotacao, type FolhaDaCotacao, type MedidasDaCotacao } from "./paginacaoDaCotacao";

/*
 * A cotação formalizada para o cliente (pedido do Lucas em 2026-11-23): a página que o navegador
 * imprime ou salva em PDF ("Salvar como PDF"), no computador e no celular, sem programa novo. O menu e a
 * barra somem na impressão (Layout.module.css). Os valores aparecem mesmo com "Ocultar valores": a
 * cotação é para o cliente ver. Sem contato do representante, como o Lucas decidiu. A quantidade vai em
 * peças, e não em centos como no app antigo (decisão do Lucas em 2026-11-23).
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
        {/* O "Microsoft Print to PDF" do Windows troca o A4 pelo Carta e desenha as letras (visto em 2026-11-23) */}
        <p className={estilos.dica}>
          Na janela de impressão, escolha o destino <strong>Salvar como PDF</strong>: o arquivo sai em A4 e com o texto selecionável. Não use o "Microsoft Print to PDF", que muda o papel.
        </p>
      </div>
      <Folhas cotacao={cotacao} catalogo={catalogo} nomeDoLogin={situacao.representante.nome} hoje={dataDoMomento(situacao.relogio)} />
    </>
  );
}

type PropsDasFolhas = { cotacao: Cotacao; catalogo: CatalogoDoCliente; nomeDoLogin: string; hoje: string };

/**
 * A cotação em folhas A4, com tudo o que o relatório do pedido do app antigo dos representantes mostra
 * (frmPedidos_RelPedidoEnvio) e o que a cotação tem a mais, na ordem em que o cliente lê: para quem é,
 * em que condições, o que leva e quanto dá, e para onde vai. As folhas são montadas aqui, e não pelo
 * navegador, para cada uma ter o cliente no topo, "Página X de Y" no rodapé e o "continua" no fim dos
 * itens (pedido do Lucas em 2026-11-23): primeiro as partes são desenhadas escondidas e medidas; depois,
 * divididas pelas folhas.
 */
function Folhas({ cotacao, catalogo, nomeDoLogin, hoje }: PropsDasFolhas) {
  const emitidaEm = dataDoMomento(cotacao.atualizadoEm);
  const validaAte = somarDias(emitidaEm, DIAS_DE_VALIDADE_DA_COTACAO);
  const cliente = catalogo.dadosDoPedido?.cadastro.razaoSocial ?? catalogo.cliente.nome;
  useTituloDoArquivo(`Cotação Suprens - ${catalogo.cliente.nome} - ${formatarData(emitidaEm).replaceAll("/", "-")}`);
  const medidor = useRef<HTMLDivElement>(null);
  const paginacao = usePaginacao(medidor);

  const ipi = catalogo.dadosDoPedido?.ipi ?? null;
  const peso = pesoDosItens(cotacao.itens, new Map(catalogo.produtos.map((produto) => [produto.codigo, produto.pesoKg])));
  const representante = catalogo.representante ? `${catalogo.representante.codigo} - ${catalogo.representante.nome}` : nomeDoLogin;
  const abertura = [
    <Topo key="topo" cotacao={cotacao} validaAte={validaAte} />,
    <ClienteDaCotacao key="cliente" catalogo={catalogo} />,
    <CondicoesDaCotacao key="condicoes" cotacao={cotacao} catalogo={catalogo} representante={representante} hoje={hoje} />,
  ];
  const cabecalhoCurto = <CabecalhoCurto cliente={cliente} documento={catalogo.dadosDoPedido?.cadastro.documento ?? formatarDocumentoDoCliente(catalogo.cliente)} />;
  const totais = (
    <div className={estilos.corpo} data-totais>
      <TotaisDaCotacao totais={totaisDoPedido(cotacao.itens, ipi)} peso={peso} />
    </div>
  );
  const fechamento = [
    <EnderecosDaCotacao key="enderecos" cotacao={cotacao} catalogo={catalogo} />,
    cotacao.observacao.trim() ? (
      <Bloco key="observacoes" titulo="Observações" semGrade>
        <p className={estilos.observacao}>{cotacao.observacao}</p>
      </Bloco>
    ) : null,
    <p key="condicoesGerais" className={estilos.condicoesGerais}>
      Preços em reais, por cento de peças. Cotação válida até {formatarData(validaAte)}. O valor total é com IPI e sem ICMS-ST. A ST, quando devida, conforme o estado de
      destino e a finalidade da compra, será cobrada na nota fiscal.
    </p>,
  ].filter((parte) => parte !== null);
  const itens = (trecho: TrechoDosItens, larguras: readonly number[] | null) => (
    <ItensDaCotacao cotacao={cotacao} catalogo={catalogo} pesoPorItem={peso.porItem} trecho={trecho} larguras={larguras} />
  );
  const rodape = (pagina: number, total: number) => (
    <footer className={estilos.rodapePagina}>
      <span>
        Metalúrgica Suprens Ltda · Cotação para {cliente} · emitida em {formatarData(emitidaEm)}
      </span>
      <span className={estilos.numeroDaPagina}>
        Página {pagina} de {total}
      </span>
    </footer>
  );

  if (!paginacao) {
    return (
      <div ref={medidor} className={estilos.medidor} aria-hidden="true">
        <section className={estilos.pagina}>
          <div className={estilos.conteudo} data-medida="util" />
          {rodape(1, 1)}
        </section>
        <div className={estilos.coluna}>
          {abertura.map((parte) => (
            <div key={parte.key} data-medida="abertura">
              {parte}
            </div>
          ))}
          <div data-medida="cabecalhoCurto">{cabecalhoCurto}</div>
          <div data-medida="itens">
            <CaixaDosItens continuaNa={2}>
              {itens({ primeiro: 0, fim: cotacao.itens.length }, null)}
              {totais}
            </CaixaDosItens>
          </div>
          {fechamento.map((parte) => (
            <div key={parte.key} data-medida="fechamento">
              {parte}
            </div>
          ))}
          <div data-medida="fim" />
        </div>
      </div>
    );
  }
  const { folhas, larguras } = paginacao;
  return (
    <div className={estilos.folhas} aria-label="Cotação para imprimir">
      {folhas.map((folha, indice) => (
        <section key={indice} className={estilos.pagina}>
          <div className={estilos.conteudo}>
            {indice === 0 ? abertura : cabecalhoCurto}
            {temCaixaDosItens(folha) ? (
              <CaixaDosItens continuaNa={folha.isContinua ? indice + 2 : null}>
                {itens(folha, larguras)}
                {folha.temTotais ? totais : null}
              </CaixaDosItens>
            ) : null}
            {fechamento.slice(folha.primeiroDoFechamento, folha.fimDoFechamento)}
          </div>
          {rodape(indice + 1, folhas.length)}
        </section>
      ))}
    </div>
  );
}

const temCaixaDosItens = (folha: FolhaDaCotacao) => folha.fim > folha.primeiro || folha.temTotais;

type Paginacao = { folhas: FolhaDaCotacao[]; larguras: number[] };

/** Mede as partes desenhadas no medidor e divide a cotação em folhas; até lá, devolve null. */
function usePaginacao(medidor: RefObject<HTMLDivElement | null>): Paginacao | null {
  const [paginacao, setPaginacao] = useState<Paginacao | null>(null);
  useEffect(() => {
    let atual = true;
    // Mede com as fontes da folha carregadas: com a letra de reserva, as linhas teriam outra altura.
    void document.fonts.ready.then(() => {
      if (!atual || !medidor.current) return;
      const { medidas, larguras } = medir(medidor.current);
      setPaginacao({ folhas: paginarCotacao(medidas), larguras });
    });
    return () => {
      atual = false;
    };
  }, [medidor]);
  return paginacao;
}

/** Uma sobra contra o arredondamento das medidas, para a última linha nunca encostar no rodapé. */
const FOLGA_EM_PIXELS = 2;

function medir(medidor: HTMLElement): { medidas: MedidasDaCotacao; larguras: number[] } {
  const parte = (seletor: string) => {
    const elemento = medidor.querySelector<HTMLElement>(seletor);
    if (!elemento) throw new Error(`Parte da cotação sem medida: ${seletor}`);
    return elemento;
  };
  const somaDe = (nome: string) => [...medidor.querySelectorAll<HTMLElement>(`[data-medida="${nome}"]`)].reduce((soma, elemento) => soma + alturaComEspaco(elemento), 0);
  const caixa = parte('[data-medida="itens"]');
  const linhas = [...caixa.querySelectorAll("tbody tr")].map(alturaDe);
  const continua = alturaDe(parte("[data-continua]"));
  const totais = alturaDe(parte("[data-totais]"));
  const medidas: MedidasDaCotacao = {
    util: parte('[data-medida="util"]').clientHeight - FOLGA_EM_PIXELS,
    abertura: somaDe("abertura"),
    cabecalhoCurto: somaDe("cabecalhoCurto"),
    caixaVazia: alturaComEspaco(caixa) - linhas.reduce((soma, altura) => soma + altura, 0) - continua - totais,
    linhas,
    continua,
    totais,
    fechamento: [...medidor.querySelectorAll<HTMLElement>('[data-medida="fechamento"]')].map(alturaComEspaco),
  };
  const larguras = [...caixa.querySelectorAll("thead tr:last-child th")].map((coluna) => coluna.getBoundingClientRect().width);
  return { medidas, larguras };
}

const alturaDe = (elemento: Element) => elemento.getBoundingClientRect().height;

/** A altura da parte mais o espaço até a seguinte: a distância entre o topo de uma e o da outra. */
function alturaComEspaco(parte: HTMLElement): number {
  const seguinte = parte.nextElementSibling;
  if (!seguinte) throw new Error("A coluna do medidor termina num marcador");
  return seguinte.getBoundingClientRect().top - parte.getBoundingClientRect().top;
}

function Topo({ cotacao, validaAte }: { cotacao: Cotacao; validaAte: string }) {
  return (
    <header className={estilos.topo}>
      <img src="/marca/suprens-96.png" alt="Suprens" width={64} height={61} />
      <div className={estilos.titulo}>
        <p className={estilos.empresa}>Metalúrgica Suprens Ltda</p>
        <h2>Cotação</h2>
      </div>
      <dl className={estilos.datas}>
        <Dado rotulo="Emitida em">
          {formatarData(dataDoMomento(cotacao.atualizadoEm))} às {horaDoMomento(cotacao.atualizadoEm)}
        </Dado>
        <Dado rotulo="Válida até">{formatarData(validaAte)}</Dado>
      </dl>
    </header>
  );
}

/** O topo das folhas seguintes: o cliente, sem as datas, que ficam só na primeira (pedido do Lucas em 2026-11-23). */
function CabecalhoCurto({ cliente, documento }: { cliente: string; documento: string }) {
  return (
    <header className={estilos.cabecalhoCurto}>
      <img src="/marca/suprens-96.png" alt="" width={28} height={27} />
      <strong>Cotação</strong>
      <span>
        {cliente} · {documento}
      </span>
    </header>
  );
}

/** O cliente como o cadastro do ERP: o que o relatório do app antigo mostra no bloco "Cliente". */
function ClienteDaCotacao({ catalogo }: { catalogo: CatalogoDoCliente }) {
  const cadastro = catalogo.dadosDoPedido?.cadastro ?? null;
  if (!cadastro) {
    return (
      <Bloco titulo="Cliente">
        <Dado rotulo="Razão social" colunas={3}>
          {catalogo.cliente.nome}
        </Dado>
        <Dado rotulo="CNPJ/CPF">{formatarDocumentoDoCliente(catalogo.cliente)}</Dado>
      </Bloco>
    );
  }
  const { faturamento } = cadastro;
  return (
    <Bloco titulo="Cliente">
      <Dado rotulo="Razão social" colunas={2} isDestaque>
        {cadastro.razaoSocial}
      </Dado>
      <Dado rotulo="CNPJ/CPF">{cadastro.documento}</Dado>
      <Dado rotulo="Fone">{cadastro.telefone ?? "—"}</Dado>
      <Dado rotulo="Inscrição estadual">{cadastro.inscricaoEstadual ?? "—"}</Dado>
      <Dado rotulo="Suframa">{cadastro.suframa ?? "—"}</Dado>
      <Dado rotulo="E-mail do XML" colunas={2}>
        {cadastro.emailDoXml ?? "—"}
      </Dado>
      <Dado rotulo="Endereço" colunas={2}>
        {faturamento.texto}
        {faturamento.bairro ? ` · ${faturamento.bairro}` : ""}
      </Dado>
      <Dado rotulo="Cidade/UF">
        {faturamento.cidade}/{faturamento.uf}
      </Dado>
      <Dado rotulo="CEP">{faturamento.cep ? formatarCep(faturamento.cep) : "—"}</Dado>
    </Bloco>
  );
}

type PropsDasCondicoes = { cotacao: Cotacao; catalogo: CatalogoDoCliente; representante: string; hoje: string };

function CondicoesDaCotacao({ cotacao, catalogo, representante, hoje }: PropsDasCondicoes) {
  const dados = catalogo.dadosDoPedido;
  const escolhas = cotacao.escolhas;
  const entrega = cotacao.entrega ? `Programada para ${formatarData(cotacao.entrega)}` : `Assim que possível, a partir de ${formatarData(primeiraEntregaPossivel(hoje))}`;
  return (
    <Bloco titulo="Condições comerciais">
      {dados && escolhas ? (
        <>
          <Dado rotulo="Condição de pagamento">{dados.condicoes.find((condicao) => condicao.codigo === escolhas.condicaoDePagamento)?.descricao ?? escolhas.condicaoDePagamento}</Dado>
          <Dado rotulo="Classificação da venda">{ROTULOS_DA_CLASSIFICACAO[escolhas.classificacao]}</Dado>
          <Dado rotulo="Nº pedido do cliente">{escolhas.pedidoDoCliente.trim() || "—"}</Dado>
          <Dado rotulo="Frete parcial">{escolhas.aceitaParcial ? "Aceita" : "Não aceita"}</Dado>
        </>
      ) : null}
      <Dado rotulo="Entrega" colunas={2}>
        {entrega}
      </Dado>
      <Dado rotulo="Representante" colunas={2}>
        {representante}
      </Dado>
    </Bloco>
  );
}

/** A caixa dos itens; a que segue na folha seguinte fecha com a borda tracejada e o "continua". */
function CaixaDosItens({ continuaNa, children }: { continuaNa: number | null; children: ReactNode }) {
  return (
    <section className={continuaNa === null ? estilos.bloco : `${estilos.bloco} ${estilos.aberto}`}>
      {children}
      {continuaNa === null ? null : (
        <p className={estilos.continua} data-continua>
          Continua na página {continuaNa} →
        </p>
      )}
    </section>
  );
}

/** Os itens de uma folha: do índice `primeiro` até antes do `fim`. */
type TrechoDosItens = { primeiro: number; fim: number };

type PropsDosItens = {
  cotacao: Cotacao;
  catalogo: CatalogoDoCliente;
  pesoPorItem: readonly (number | null)[];
  trecho: TrechoDosItens;
  /** As larguras medidas na tabela inteira, para as colunas ficarem iguais em todas as folhas. */
  larguras: readonly number[] | null;
};

/**
 * Os itens: só o código do produto, sem o part number (decisão do Lucas em 2026-11-23). As colunas da
 * ordem de compra só aparecem quando algum item a tem.
 */
function ItensDaCotacao({ cotacao, catalogo, pesoPorItem, trecho, larguras }: PropsDosItens) {
  const ipi = catalogo.dadosDoPedido?.ipi ?? null;
  const temOrdem = cotacao.itens.some((item) => item.ordemDeCompra !== null || item.itemDaOrdemDeCompra !== null) || Boolean(cotacao.escolhas?.pedidoDoCliente.trim());
  const ordemDoPedido = cotacao.escolhas?.pedidoDoCliente.trim() ?? "";
  const temPartNumber = cotacao.itens.some((item) => item.partNumber !== null);
  // Item, produto, quantidade, cento, valor sem IPI e peso; mais o part number, a ordem de compra e o IPI, quando há.
  const colunas = 6 + (temPartNumber ? 1 : 0) + (temOrdem ? 2 : 0) + (ipi ? 2 : 0);
  return (
    <table className={larguras ? `${estilos.itens} ${estilos.colunasFixas}` : estilos.itens}>
      {larguras ? (
        <colgroup>
          {larguras.map((largura, indice) => (
            <col key={indice} style={{ width: largura }} />
          ))}
        </colgroup>
      ) : null}
      <thead>
        <tr>
          <th colSpan={colunas} className={estilos.faixa}>
            Itens{trecho.primeiro > 0 ? <span className={estilos.continuacao}> (continuação)</span> : null}
          </th>
        </tr>
        <tr>
          <th>Item</th>
          <th>Produto</th>
          {temPartNumber ? <th>Part number</th> : null}
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
          <th className={estilos.numero}>Peso (kg)</th>
        </tr>
      </thead>
      <tbody>
        {cotacao.itens.slice(trecho.primeiro, trecho.fim).map((item, indiceNoTrecho) => {
          const posicao = trecho.primeiro + indiceNoTrecho;
          const semIpi = valorDaLinha(item);
          const valorIpi = ipi ? valorDoIpi(item, ipi) : 0;
          const pesoDoItem = pesoPorItem[posicao] ?? null;
          return (
            <tr key={item.codigo}>
              <td>{posicao + 1}</td>
              <td className={estilos.codigo}>{item.codigo}</td>
              {temPartNumber ? <td className={estilos.codigo}>{item.partNumber ?? ""}</td> : null}
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
              <td className={estilos.numero}>{pesoDoItem === null ? "—" : formatarComCentavos(pesoDoItem)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Os totais logo abaixo dos itens, à direita, como no fim de uma nota: o valor com IPI é o destaque. */
function TotaisDaCotacao({ totais, peso }: { totais: TotaisDoPedido; peso: ReturnType<typeof pesoDosItens> }) {
  return (
    <div className={estilos.totais}>
      <dl className={estilos.quantidades}>
        <Total rotulo="Itens" Icone={ListOrdered}>
          {formatarNumero(totais.itens)}
        </Total>
        <Total rotulo="Quantidade" Icone={Package}>
          {formatarNumero(totais.pecas)} pç
        </Total>
        <Total rotulo="Peso total" Icone={Weight}>
          {formatarPeso(peso.total)}
          {peso.semPeso > 0 ? <span className={estilos.nota}> ({formatarContagem(peso.semPeso, "item sem peso", "itens sem peso")})</span> : null}
        </Total>
      </dl>
      <dl className={estilos.valores}>
        <Total rotulo="Valor s/ IPI">{formatarReaisComCentavos(totais.semIpi)}</Total>
        {totais.ipi !== null && totais.comIpi !== null ? (
          <>
            <Total rotulo={rotuloDoIpi(totais)}>{formatarReaisComCentavos(totais.ipi)}</Total>
            <Total rotulo="Valor total c/ IPI" isDestaque>
              {formatarReaisComCentavos(totais.comIpi)}
            </Total>
          </>
        ) : null}
      </dl>
    </div>
  );
}

/** "IPI (2,84%)": a alíquota do pedido inteiro entre parênteses (pedido do Lucas em 2026-11-23). */
function rotuloDoIpi(totais: TotaisDoPedido): string {
  const aliquota = aliquotaDoIpi(totais);
  return aliquota === null ? "IPI" : `IPI (${formatarAliquota(aliquota)})`;
}

type PropsDoTotal = { rotulo: string; Icone?: LucideIcon; isDestaque?: boolean; children: ReactNode };

/**
 * Uma linha dos totais: o nome à esquerda e o número à direita. O ícone pequeno, só nas quantidades
 * (escolha do Lucas em 2026-11-23): nos valores em reais, a coluna fica limpa, como numa nota.
 */
function Total({ rotulo, Icone, isDestaque = false, children }: PropsDoTotal) {
  return (
    <div className={isDestaque ? `${estilos.total} ${estilos.totalEmDestaque}` : estilos.total}>
      <dt>
        {Icone ? <Icone size={13} strokeWidth={1.75} className={estilos.iconeDoTotal} aria-hidden="true" /> : null}
        {rotulo}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * Entrega, cobrança e transporte, como os "Endereços Complementares" do relatório do app antigo: uma
 * linha larga para cada um, com o nome em negrito ao lado (pedido do Lucas em 2026-11-23). Entrega e
 * cobrança no faturamento viram uma linha só.
 */
function EnderecosDaCotacao({ cotacao, catalogo }: { cotacao: Cotacao; catalogo: CatalogoDoCliente }) {
  const dados = catalogo.dadosDoPedido;
  if (!dados) return null;
  const { entrega, cobranca } = dados.cadastro;
  return (
    <Bloco titulo="Entrega, cobrança e transporte" semGrade>
      <dl className={estilos.linhas}>
        {entrega || cobranca ? (
          <>
            <Linha rotulo="Entrega">
              <Local local={entrega} />
            </Linha>
            <Linha rotulo="Cobrança">
              <Local local={cobranca} />
            </Linha>
          </>
        ) : (
          <Linha rotulo="Entrega e cobrança">No endereço do faturamento</Linha>
        )}
        <Linha rotulo="Transportadora">
          <Transportadora cotacao={cotacao} dados={dados} />
        </Linha>
      </dl>
    </Bloco>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt>{rotulo}:</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Local({ local }: { local: LocalDoCadastro | null }) {
  if (!local) return "No endereço do faturamento";
  return (
    <>
      <strong>{local.razaoSocial}</strong> · CNPJ {local.documento}
      {local.inscricaoEstadual ? ` · IE ${local.inscricaoEstadual}` : ""}
      <br />
      {[local.texto, local.bairro, `${local.cidade}/${local.uf}`, local.cep ? formatarCep(local.cep) : null].filter(Boolean).join(" · ")}
    </>
  );
}

type DadosDoPedido = NonNullable<CatalogoDoCliente["dadosDoPedido"]>;

function Transportadora({ cotacao, dados }: { cotacao: Cotacao; dados: DadosDoPedido }) {
  const escolhida = cotacao.escolhas?.transportadora ?? null;
  if (escolhida && "nova" in escolhida) {
    const { nova } = escolhida;
    return (
      <>
        <strong>{nova.nome}</strong> · CNPJ {formatarCnpj(nova.cnpj)}
        <br />
        {nova.cidade}/{nova.uf}
      </>
    );
  }
  const transportadora = escolhida ? transportadoraDe(dados, escolhida.codigo) : null;
  if (!transportadora) return "A combinar";
  return (
    <>
      <strong>{transportadora.razaoSocial}</strong> · CNPJ {transportadora.cnpj}
      <br />
      {[transportadora.endereco, transportadora.bairro, `${transportadora.cidade}/${transportadora.uf}`, transportadora.cep ? formatarCep(transportadora.cep) : null]
        .filter(Boolean)
        .join(" · ")}
    </>
  );
}

type PropsDoBloco = { titulo: string; semGrade?: boolean; children: ReactNode };

/** Uma parte da folha: a faixa com o título e, embaixo, os dados numa grade (ou o conteúdo como vem). */
function Bloco({ titulo, semGrade = false, children }: PropsDoBloco) {
  return (
    <section className={estilos.bloco}>
      <h3 className={estilos.faixa}>{titulo}</h3>
      <div className={estilos.corpo}>{semGrade ? children : <dl className={estilos.dados}>{children}</dl>}</div>
    </section>
  );
}

type PropsDoDado = { rotulo: string; colunas?: 1 | 2 | 3; isDestaque?: boolean; children: ReactNode };

function Dado({ rotulo, colunas = 1, isDestaque = false, children }: PropsDoDado) {
  const classes = [colunas > 1 ? estilos[`ocupa${colunas}`] : "", isDestaque ? estilos.destaque : ""].filter(Boolean).join(" ");
  return (
    <div className={classes || undefined}>
      <dt>{rotulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * O título da página enquanto a folha está aberta: é o nome que o "Salvar como PDF" sugere para o arquivo.
 * Ao sair, volta o de antes.
 */
function useTituloDoArquivo(titulo: string): void {
  useEffect(() => {
    const anterior = document.title;
    document.title = titulo;
    return () => {
      document.title = anterior;
    };
  }, [titulo]);
}
