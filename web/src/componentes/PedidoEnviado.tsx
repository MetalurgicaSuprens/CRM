import { valorDaLinha } from "dominio/pedido";
import { aliquotaDoIpi, condicoesDoEnvio, pesoDosItens, totaisDoPedido, valorDoIpi } from "../dados/dadosDoPedido";
import { passosDoAndamento, type PassoDoAndamento } from "../dados/pedido";
import type { CatalogoDoCliente, DadosDoPedido, ItemEnviado, LocalDoCadastro, PedidoEnviado } from "../dados/tipos";
import { formatarAliquota, formatarCep, formatarContagem, formatarDocumentoDoCliente, formatarMomento, formatarNumero, formatarPeso } from "../formato";
import { CondicoesDoPedido, colunasDasReferencias, Fatos } from "./CondicoesDoPedido";
import { ETAPAS } from "./EtapaDoPedido";
import { DetalheDoFato, Fato } from "./Fato";
import { Identificacao, ORDEM_DOS_ITENS, TabelaResponsiva, type ColunaDaTabela } from "./TabelaResponsiva";
import { Valor } from "./Valor";
import estilos from "./PedidoEnviado.module.css";

/*
 * O pedido enviado pelo CRM, na página do pedido e na linha aberta da aba Enviados.
 */

/** Do envio até o faturamento: o que já aconteceu, a situação atual e o que falta. */
export function AndamentoDoPedido({ pedido, relogio }: { pedido: PedidoEnviado; relogio: string }) {
  return (
    <ol className={estilos.linhaDoTempo}>
      {passosDoAndamento(pedido).map((passo) => (
        <li key={passo.etapa} className={`${estilos.passo} ${estilos[passo.estado]} ${pedido.etapa === "recusado" && passo.estado === "atual" ? estilos.recusado : ""}`}>
          <span className={estilos.marcador} aria-hidden="true" />
          <span className={estilos.textoDoPasso}>
            <span className={estilos.nomeDoPasso}>
              {ETAPAS[passo.etapa].rotulo}
              <span className="visualmente-oculto">{passo.estado === "feito" ? ", feito" : passo.estado === "atual" ? ", situação atual" : ", ainda não"}</span>
            </span>
            {passo.em ? <span className={estilos.suave}>{formatarMomento(passo.em, relogio)}</span> : null}
            <DetalheDoPasso passo={passo} pedido={pedido} />
          </span>
        </li>
      ))}
    </ol>
  );
}

function DetalheDoPasso({ passo, pedido }: { passo: PassoDoAndamento; pedido: PedidoEnviado }) {
  if (passo.estado === "futuro") return null;
  switch (passo.etapa) {
    case "recebido":
      return pedido.numeroSgi ? <span className={estilos.detalhe}>Número no SGI: {pedido.numeroSgi}</span> : null;
    case "em_aprovacao":
      return <span className={estilos.detalhe}>Bloqueado no SGI até as aprovações de sempre.</span>;
    case "no_erp":
      return pedido.numeroErp ? <span className={estilos.detalhe}>Número no ERP: {pedido.numeroErp}</span> : null;
    case "recusado":
      return pedido.motivoRecusa ? <span className={`${estilos.detalhe} ${estilos.motivo}`}>{pedido.motivoRecusa}</span> : null;
    default:
      return null;
  }
}

/**
 * Tudo o que o representante preencheu além dos itens, na ordem da inclusão (pedido do Lucas em
 * 2026-11-24): para quem é e em que condições. O cadastro vem do ERP de agora; as escolhas, do envio.
 */
export function CondicoesDoPedidoEnviado({ pedido, dados }: { pedido: PedidoEnviado; dados: DadosDoPedido | null }) {
  return (
    <div className={estilos.condicoes}>
      <section className={estilos.parte}>
        <h3 className={estilos.tituloDaParte}>Cliente</h3>
        <Fatos>
          <Fato rotulo="Razão social" largo>
            {dados?.cadastro.razaoSocial ?? pedido.cliente.nome}
          </Fato>
          <Fato rotulo="CNPJ/CPF">{dados?.cadastro.documento ?? formatarDocumentoDoCliente(pedido.cliente)}</Fato>
          <Fato rotulo="Entrega" largo>
            <LocalDaEntrega local={dados?.cadastro.entrega ?? null} />
          </Fato>
        </Fatos>
      </section>
      <section className={estilos.parte}>
        <h3 className={estilos.tituloDaParte}>Condições do pedido</h3>
        <CondicoesDoPedido condicoes={condicoesDoEnvio(pedido, dados)} />
      </section>
    </div>
  );
}

function LocalDaEntrega({ local }: { local: LocalDoCadastro | null }) {
  if (!local) return "No endereço do faturamento";
  return (
    <>
      {local.razaoSocial}
      <DetalheDoFato>
        {[local.texto, local.bairro, `${local.cidade}/${local.uf}`, local.cep ? formatarCep(local.cep) : null].filter(Boolean).join(" · ")}
      </DetalheDoFato>
    </>
  );
}

type PropsDosItens = { pedido: PedidoEnviado; catalogo: CatalogoDoCliente | null };

/**
 * Os itens como na tabela do PDF: o part number e a ordem de compra só quando algum item tem; o IPI,
 * pelas alíquotas do ERP de agora, quando a foto as traz.
 */
export function ItensDoPedidoEnviado({ pedido, catalogo }: PropsDosItens) {
  const ipi = catalogo?.dadosDoPedido?.ipi ?? null;
  const colunas: [ColunaDaTabela<ItemEnviado>, ...ColunaDaTabela<ItemEnviado>[]] = [
    { titulo: "Produto", ordenarPor: (item) => item.codigo, celula: (item) => <Identificacao titulo={item.codigo} detalhe={[item.familia, item.medida].filter(Boolean).join(" · ")} /> },
    ...colunasDasReferencias(pedido.itens, pedido.escolhas.pedidoDoCliente.trim() || null),
    { titulo: "Peças", numerica: true, largura: 5, fixa: true, ordenarPor: (item) => item.quantidade, celula: (item) => formatarNumero(item.quantidade) },
    { titulo: "Cento", numerica: true, largura: 5.5, fixa: true, ordenarPor: (item) => item.precoCento, celula: (item) => <Valor valor={item.precoCento} comCentavos /> },
    { titulo: "Valor s/ IPI", numerica: true, largura: 6.5, fixa: true, ordenarPor: valorDaLinha, celula: (item) => <Valor valor={valorDaLinha(item)} comCentavos /> },
    ...(ipi ? colunasDoIpi(ipi) : []),
  ];
  return (
    <div className={estilos.itens}>
      <TabelaResponsiva
        descricao={`Itens do pedido ${pedido.numero}`}
        itens={pedido.itens}
        chaveDe={(item) => item.codigo}
        vazio="Pedido sem itens."
        parametroDaOrdem={ORDEM_DOS_ITENS}
        colunas={colunas}
      />
      <Totais pedido={pedido} catalogo={catalogo} />
    </div>
  );
}

function colunasDoIpi(ipi: Readonly<Record<string, number>>): ColunaDaTabela<ItemEnviado>[] {
  const comIpi = (item: ItemEnviado) => valorDaLinha(item) + valorDoIpi(item, ipi);
  return [
    { titulo: "IPI", numerica: true, largura: 5.5, fixa: true, ordenarPor: (item) => valorDoIpi(item, ipi), celula: (item) => <Valor valor={valorDoIpi(item, ipi)} comCentavos /> },
    { titulo: "Valor c/ IPI", numerica: true, largura: 6.5, fixa: true, ordenarPor: comIpi, celula: (item) => <Valor valor={comIpi(item)} comCentavos /> },
  ];
}

/** Os totais do envio, como no PDF, e o total que o SGI recalculou, quando já recebeu o pedido. */
function Totais({ pedido, catalogo }: PropsDosItens) {
  const totais = totaisDoPedido(pedido.itens, catalogo?.dadosDoPedido?.ipi ?? null);
  const peso = catalogo ? pesoDosItens(pedido.itens, new Map(catalogo.produtos.map((produto) => [produto.codigo, produto.pesoKg]))) : null;
  const aliquota = aliquotaDoIpi(totais);
  return (
    <div className={estilos.totais}>
      <p className={estilos.suave}>
        {formatarContagem(totais.itens, "item", "itens")} · {formatarNumero(totais.pecas)} peças
        {peso ? ` · ${formatarPeso(peso.total)}` : ""}
      </p>
      <LinhaDoTotal rotulo="Valor s/ IPI" valor={totais.semIpi} />
      {totais.ipi !== null && totais.comIpi !== null ? (
        <>
          <LinhaDoTotal rotulo={aliquota === null ? "IPI" : `IPI (${formatarAliquota(aliquota)})`} valor={totais.ipi} />
          <LinhaDoTotal rotulo="Valor c/ IPI" valor={totais.comIpi} isDestaque />
        </>
      ) : null}
      {pedido.totalSgi === null ? (
        <p className={estilos.suave}>O SGI recalcula o total quando recebe o pedido.</p>
      ) : (
        <LinhaDoTotal rotulo="Total no SGI, sem IPI" valor={pedido.totalSgi} />
      )}
    </div>
  );
}

function LinhaDoTotal({ rotulo, valor, isDestaque = false }: { rotulo: string; valor: number; isDestaque?: boolean }) {
  return (
    <div className={isDestaque ? `${estilos.linhaDoTotal} ${estilos.totalEmDestaque}` : estilos.linhaDoTotal}>
      <span>{rotulo}</span>
      <Valor valor={valor} comCentavos />
    </div>
  );
}
