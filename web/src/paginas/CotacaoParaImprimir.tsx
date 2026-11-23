import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router";
import { Printer } from "lucide-react";
import { dataDoMomento, horaDoMomento, somarDias } from "dominio/datas";
import { primeiraEntregaPossivel, valorDaLinha } from "dominio/pedido";
import botoes from "../componentes/Botao.module.css";
import { CabecalhoPagina } from "../componentes/CabecalhoPagina";
import { Voltar } from "../componentes/Voltar";
import { carregarCatalogo, carregarCotacao, carregarSituacaoDosDados } from "../dados/api";
import { ROTULOS_DA_CLASSIFICACAO, formatarCnpj, pesoDosItens, totaisDoPedido, transportadoraDe, valorDoIpi, type TotaisDoPedido } from "../dados/dadosDoPedido";
import type { CatalogoDoCliente, Cotacao, LocalDoCadastro } from "../dados/tipos";
import { useCarga } from "../dados/useCarga";
import {
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
        <p className={estilos.dica}>Na janela de impressão, escolha "Salvar como PDF" para mandar o arquivo ao cliente.</p>
      </div>
      <Folha cotacao={cotacao} catalogo={catalogo} nomeDoLogin={situacao.representante.nome} hoje={dataDoMomento(situacao.relogio)} />
    </>
  );
}

type PropsDaFolha = { cotacao: Cotacao; catalogo: CatalogoDoCliente; nomeDoLogin: string; hoje: string };

/**
 * A folha A4, com tudo o que o relatório do pedido do app antigo dos representantes mostra
 * (frmPedidos_RelPedidoEnvio) e o que a cotação tem a mais, na ordem em que o cliente lê: para quem é,
 * em que condições, o que leva e quanto dá, e para onde vai.
 */
function Folha({ cotacao, catalogo, nomeDoLogin, hoje }: PropsDaFolha) {
  const emitidaEm = dataDoMomento(cotacao.atualizadoEm);
  const validaAte = somarDias(emitidaEm, DIAS_DE_VALIDADE_DA_COTACAO);
  useTituloDoArquivo(`Cotação Suprens - ${catalogo.cliente.nome} - ${formatarData(emitidaEm).replaceAll("/", "-")}`);
  const ipi = catalogo.dadosDoPedido?.ipi ?? null;
  const peso = pesoDosItens(cotacao.itens, new Map(catalogo.produtos.map((produto) => [produto.codigo, produto.pesoKg])));
  const representante = catalogo.representante ? `${catalogo.representante.codigo} - ${catalogo.representante.nome}` : nomeDoLogin;
  return (
    <article className={estilos.folha} aria-label="Cotação para imprimir">
      <header className={estilos.topo}>
        <img src="/marca/suprens-96.png" alt="Suprens" width={64} height={61} />
        <div className={estilos.titulo}>
          <p className={estilos.empresa}>Metalúrgica Suprens Ltda</p>
          <h2>Cotação</h2>
        </div>
        <dl className={estilos.datas}>
          <Dado rotulo="Emitida em">
            {formatarData(emitidaEm)} às {horaDoMomento(cotacao.atualizadoEm)}
          </Dado>
          <Dado rotulo="Válida até">{formatarData(validaAte)}</Dado>
        </dl>
      </header>

      <ClienteDaCotacao catalogo={catalogo} />
      <CondicoesDaCotacao cotacao={cotacao} catalogo={catalogo} representante={representante} hoje={hoje} />

      <Bloco titulo="Itens" semGrade podeQuebrar>
        <ItensDaCotacao cotacao={cotacao} catalogo={catalogo} pesoPorItem={peso.porItem} />
        <TotaisDaCotacao totais={totaisDoPedido(cotacao.itens, ipi)} peso={peso} />
      </Bloco>

      <EnderecosDaCotacao cotacao={cotacao} catalogo={catalogo} />

      {cotacao.observacao.trim() ? (
        <Bloco titulo="Observações" semGrade>
          <p className={estilos.observacao}>{cotacao.observacao}</p>
        </Bloco>
      ) : null}

      <footer className={estilos.rodape}>
        Preços em reais, por cento de peças. Cotação válida até {formatarData(validaAte)}.
        <br />
        O valor total é com IPI e sem ICMS-ST. A ST, quando devida, conforme o estado de destino e a finalidade da compra, será cobrada na nota fiscal.
      </footer>
    </article>
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

type PropsDosItens = { cotacao: Cotacao; catalogo: CatalogoDoCliente; pesoPorItem: readonly (number | null)[] };

/** Os itens: só o código do produto, sem o part number (decisão do Lucas em 2026-11-23). */
function ItensDaCotacao({ cotacao, catalogo, pesoPorItem }: PropsDosItens) {
  const ipi = catalogo.dadosDoPedido?.ipi ?? null;
  const temOrdem = cotacao.itens.some((item) => item.ordemDeCompra !== null || item.itemDaOrdemDeCompra !== null) || Boolean(cotacao.escolhas?.pedidoDoCliente.trim());
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
          <th className={estilos.numero}>Peso (kg)</th>
        </tr>
      </thead>
      <tbody>
        {cotacao.itens.map((item, posicao) => {
          const semIpi = valorDaLinha(item);
          const valorIpi = ipi ? valorDoIpi(item, ipi) : 0;
          const pesoDoItem = pesoPorItem[posicao] ?? null;
          return (
            <tr key={item.codigo}>
              <td>{posicao + 1}</td>
              <td className={estilos.codigo}>{item.codigo}</td>
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
        <Total rotulo="Itens">{formatarNumero(totais.itens)}</Total>
        <Total rotulo="Quantidade">{formatarNumero(totais.pecas)} pç</Total>
        <Total rotulo="Peso total">
          {formatarPeso(peso.total)}
          {peso.semPeso > 0 ? <span className={estilos.nota}> ({formatarContagem(peso.semPeso, "item sem peso", "itens sem peso")})</span> : null}
        </Total>
      </dl>
      <dl className={estilos.valores}>
        <Total rotulo="Valor s/ IPI">{formatarReaisComCentavos(totais.semIpi)}</Total>
        {totais.ipi !== null && totais.comIpi !== null ? (
          <>
            <Total rotulo="IPI">{formatarReaisComCentavos(totais.ipi)}</Total>
            <Total rotulo="Valor total c/ IPI" isDestaque>
              {formatarReaisComCentavos(totais.comIpi)}
            </Total>
          </>
        ) : null}
      </dl>
    </div>
  );
}

/** Uma linha dos totais: o nome à esquerda e o número à direita. */
function Total({ rotulo, isDestaque = false, children }: { rotulo: string; isDestaque?: boolean; children: ReactNode }) {
  return (
    <div className={isDestaque ? `${estilos.total} ${estilos.totalEmDestaque}` : estilos.total}>
      <dt>{rotulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Entrega, cobrança e transporte, como os "Endereços Complementares" do relatório do app antigo: um ao lado do outro. */
function EnderecosDaCotacao({ cotacao, catalogo }: { cotacao: Cotacao; catalogo: CatalogoDoCliente }) {
  const dados = catalogo.dadosDoPedido;
  if (!dados) return null;
  const escolhida = cotacao.escolhas?.transportadora ?? null;
  const transportadora = escolhida && "codigo" in escolhida ? transportadoraDe(dados, escolhida.codigo) : null;
  const nova = escolhida && "nova" in escolhida ? escolhida.nova : null;
  return (
    <Bloco titulo="Entrega, cobrança e transporte" colunas={3}>
      <Local rotulo="Entrega" local={dados.cadastro.entrega} />
      <Local rotulo="Cobrança" local={dados.cadastro.cobranca} />
      <Dado rotulo="Transportadora">
        {transportadora ? (
          <>
            <span className={estilos.linhaForte}>{transportadora.razaoSocial}</span>
            <span className={estilos.linha}>CNPJ {transportadora.cnpj}</span>
            <span className={estilos.linha}>
              {[transportadora.endereco, transportadora.bairro].filter(Boolean).join(" · ")}
            </span>
            <span className={estilos.linha}>
              {transportadora.cidade}/{transportadora.uf}
              {transportadora.cep ? ` · ${formatarCep(transportadora.cep)}` : ""}
            </span>
          </>
        ) : nova ? (
          <>
            <span className={estilos.linhaForte}>{nova.nome}</span>
            <span className={estilos.linha}>CNPJ {formatarCnpj(nova.cnpj)}</span>
            <span className={estilos.linha}>
              {nova.cidade}/{nova.uf}
            </span>
          </>
        ) : (
          "A combinar"
        )}
      </Dado>
    </Bloco>
  );
}

function Local({ rotulo, local }: { rotulo: string; local: LocalDoCadastro | null }) {
  return (
    <Dado rotulo={rotulo}>
      {local ? (
        <>
          <span className={estilos.linhaForte}>{local.razaoSocial}</span>
          <span className={estilos.linha}>
            CNPJ {local.documento}
            {local.inscricaoEstadual ? ` · IE ${local.inscricaoEstadual}` : ""}
          </span>
          <span className={estilos.linha}>{[local.texto, local.bairro].filter(Boolean).join(" · ")}</span>
          <span className={estilos.linha}>
            {local.cidade}/{local.uf}
            {local.cep ? ` · ${formatarCep(local.cep)}` : ""}
          </span>
        </>
      ) : (
        "No endereço do faturamento"
      )}
    </Dado>
  );
}

type PropsDoBloco = { titulo: string; colunas?: 3 | 4; semGrade?: boolean; podeQuebrar?: boolean; children: ReactNode };

/** Uma parte da folha: a faixa com o título e, embaixo, os dados numa grade (ou o conteúdo como vem). */
function Bloco({ titulo, colunas = 4, semGrade = false, podeQuebrar = false, children }: PropsDoBloco) {
  return (
    <section className={podeQuebrar ? estilos.bloco : `${estilos.bloco} ${estilos.inteiro}`}>
      <h3 className={estilos.faixa}>{titulo}</h3>
      <div className={estilos.corpo}>{semGrade ? children : <dl className={colunas === 3 ? `${estilos.dados} ${estilos.tresColunas}` : estilos.dados}>{children}</dl>}</div>
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
