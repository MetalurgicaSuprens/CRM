import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { DetalheDoFato, Fato } from "../componentes/Fato";
import { AndamentoDoPedido, ItensDoPedidoEnviado } from "../componentes/PedidoEnviado";
import { DataRelativa } from "../componentes/Quando";
import { Identificacao, ORDEM_DOS_ITENS, TabelaResponsiva, type ColunaDaTabela } from "../componentes/TabelaResponsiva";
import { Valor } from "../componentes/Valor";
import { valorDaLinha } from "dominio/pedido";
import { precoDoCento, resumirPorFamilia, type TotalDaFamilia } from "../dados/pedido";
import type { Cfop, ClienteResumo, ItemDoErp, NotaDoPedido, NotaFaturada, PedidoDaFicha, PedidoEnviado, PedidoNoErp } from "../dados/tipos";
import { formatarData, formatarNumero, formatarPedidosDaNota } from "../formato";
import estilos from "./DetalhesDosPedidos.module.css";

/*
 * O que a linha de um pedido mostra ao abrir, na própria lista: nas abas de Pedidos e na ficha do
 * cliente. Primeiro os dados fiscais do ERP, como o app antigo dos representantes mostra, depois o
 * resumo por família e os itens. Nas abas, o caminho para a ficha do cliente fica no fim.
 */

/** O andamento e os itens, como na página do pedido. */
export function DetalheDoEnviado({ pedido, relogio }: { pedido: PedidoEnviado; relogio: string }) {
  return (
    <>
      <ResumoPorFamilia itens={pedido.itens.map((item) => ({ familia: item.familia, pecas: item.quantidade, valor: valorDaLinha(item) }))} />
      <div className={estilos.enviado}>
        <div className={estilos.partes}>
          <section className={estilos.parte}>
            <h3 className={estilos.tituloDaParte}>Andamento</h3>
            <AndamentoDoPedido pedido={pedido} relogio={relogio} />
          </section>
          <section className={estilos.parte}>
            <h3 className={estilos.tituloDaParte}>Itens</h3>
            <ItensDoPedidoEnviado pedido={pedido} />
          </section>
        </div>
      </div>
      <Rodape>
        <LinkParaFicha cliente={pedido.cliente} />
      </Rodape>
    </>
  );
}

/** O CFOP e os valores do saldo, e os itens que ainda faltam faturar: peças, entrega e valor de cada um. */
export function DetalheDoPedidoNoErp({ pedido, hoje }: { pedido: PedidoNoErp; hoje: string }) {
  return (
    <>
      <FiscalDoPedido cfop={pedido.cfop} valor={pedido.valor} valorComIpi={pedido.valorComIpi} titulo="Saldo do pedido" />
      <ResumoPorFamilia itens={pedido.itensEmAberto} />
      <ItensDoErp descricao={`Itens em aberto do pedido ${pedido.numero}`} itens={pedido.itensEmAberto} entregaAte={hoje} />
      <Rodape>
        <LinkParaFicha cliente={pedido.cliente} />
      </Rodape>
    </>
  );
}

/** Os dados fiscais da nota, os itens faturados e o pedido de onde ela saiu. */
export function DetalheDaNota({ nota }: { nota: NotaFaturada }) {
  return (
    <>
      <FiscalDaNota nota={nota} />
      <ResumoPorFamilia itens={nota.itens} />
      <ItensDoErp descricao={`Itens da nota ${nota.numero}`} itens={nota.itens} />
      <Rodape>
        {nota.pedidos.length > 0 ? <span className={estilos.origem}>{formatarPedidosDaNota(nota.pedidos)}</span> : null}
        <LinkParaFicha cliente={nota.cliente} />
      </Rodape>
    </>
  );
}

/**
 * Na ficha do cliente: o resumo e os itens; a entrega de cada item, no pedido em aberto. A cotação
 * leva à montagem, para continuar, e o enviado, à página dele, com o andamento.
 */
export function DetalheDoPedidoDaFicha({ pedido, hoje }: { pedido: PedidoDaFicha; hoje: string }) {
  const caminho = CAMINHO_NO_CRM[pedido.status]?.(pedido.id);
  return (
    <>
      {pedido.status === "faturado" ? <NotasDoPedido pedido={pedido} /> : null}
      {pedido.status === "em_aberto" && pedido.valorComIpi !== null ? (
        <FiscalDoPedido cfop={pedido.cfop} valor={pedido.valor} valorComIpi={pedido.valorComIpi} titulo="Saldo do pedido" />
      ) : null}
      <ResumoPorFamilia itens={pedido.itens} />
      <ItensDoErp
        descricao={`Itens do pedido ${pedido.numero ?? "em cotação"}`}
        itens={pedido.itens}
        entregaAte={pedido.status === "em_aberto" ? hoje : undefined}
      />
      {caminho ? (
        <Rodape>
          <LinkDoRodape para={caminho.para}>{caminho.texto}</LinkDoRodape>
        </Rodape>
      ) : null}
    </>
  );
}

const CAMINHO_NO_CRM: Partial<Record<PedidoDaFicha["status"], (id: string) => { para: string; texto: string }>> = {
  cotacao: (id) => ({ para: `/pedidos/cotacoes/${id}`, texto: "Continuar a cotação" }),
  enviado: (id) => ({ para: `/pedidos/${id}`, texto: "Ver o andamento" }),
};

/** A nota da aba Faturados: o CFOP, quem levou e os valores, do sem IPI ao total da nota. */
function FiscalDaNota({ nota }: { nota: NotaFaturada }) {
  return (
    <section className={estilos.parte}>
      <h3 className={estilos.tituloDaParte}>Nota fiscal {nota.numero}</h3>
      <dl className={estilos.fiscal}>
        <FatoDoCfop cfop={nota.cfop} />
        <Fato rotulo="Transportadora">{nota.transportadora ?? "—"}</Fato>
        <Fato rotulo="Valor sem IPI">
          <Valor valor={nota.valor} comCentavos />
        </Fato>
        <Fato rotulo="IPI">
          <Valor valor={nota.valorIpi} comCentavos />
        </Fato>
        <Fato rotulo="Total da nota">
          <Valor valor={nota.valorTotal} comCentavos />
          <DetalheDoFato>com os impostos</DetalheDoFato>
        </Fato>
      </dl>
    </section>
  );
}

/** O pedido em aberto: o CFOP e o saldo, sem e com o IPI. */
function FiscalDoPedido({ cfop, valor, valorComIpi, titulo }: { cfop: Cfop | null; valor: number; valorComIpi: number; titulo: string }) {
  return (
    <section className={estilos.parte}>
      <h3 className={estilos.tituloDaParte}>{titulo}</h3>
      <dl className={estilos.fiscal}>
        <FatoDoCfop cfop={cfop} />
        <Fato rotulo="Valor sem IPI">
          <Valor valor={valor} comCentavos />
        </Fato>
        <Fato rotulo="IPI">
          <Valor valor={valorComIpi - valor} comCentavos />
        </Fato>
        <Fato rotulo="Valor com IPI">
          <Valor valor={valorComIpi} comCentavos />
        </Fato>
      </dl>
    </section>
  );
}

/** O pedido faturado da ficha: o CFOP e cada nota dele, com a emissão, quem levou e o total. */
function NotasDoPedido({ pedido }: { pedido: PedidoDaFicha }) {
  return (
    <section className={estilos.parte}>
      <h3 className={estilos.tituloDaParte}>{pedido.notas.length === 1 ? "Nota fiscal" : "Notas fiscais"}</h3>
      {pedido.cfop ? (
        <dl className={estilos.fiscal}>
          <FatoDoCfop cfop={pedido.cfop} />
        </dl>
      ) : null}
      <TabelaResponsiva
        descricao={`Notas do pedido ${pedido.numero ?? ""}`}
        itens={pedido.notas}
        chaveDe={(nota) => nota.numero}
        vazio="Sem nota no período."
        colunas={COLUNAS_DAS_NOTAS}
      />
    </section>
  );
}

const COLUNAS_DAS_NOTAS: readonly [ColunaDaTabela<NotaDoPedido>, ...ColunaDaTabela<NotaDoPedido>[]] = [
  { titulo: "Nota", ordenarPor: (nota) => nota.numero, celula: (nota) => `NF ${nota.numero}` },
  { titulo: "Emissão", ordenarPor: (nota) => nota.emissao, celula: (nota) => formatarData(nota.emissao) },
  { titulo: "Transportadora", largura: 10, ordenarPor: (nota) => nota.transportadora, celula: (nota) => nota.transportadora ?? "—" },
  { titulo: "Total da nota", numerica: true, ordenarPor: (nota) => nota.valorTotal, celula: (nota) => <Valor valor={nota.valorTotal} comCentavos /> },
];

/** O CFOP com a descrição embaixo, como o ERP a guarda; "—" sem CFOP. */
function FatoDoCfop({ cfop }: { cfop: Cfop | null }) {
  return (
    <Fato rotulo="CFOP" largo={cfop?.descricao !== undefined && cfop.descricao !== null}>
      {cfop?.codigo ?? "—"}
      {cfop?.descricao ? <DetalheDoFato>{cfop.descricao}</DetalheDoFato> : null}
    </Fato>
  );
}

/** Antes dos itens: as famílias do pedido, da de maior valor à de menor, com as peças e o valor de cada uma. */
function ResumoPorFamilia({ itens }: { itens: readonly TotalDaFamilia[] }) {
  if (itens.length === 0) return null;
  return (
    <section className={estilos.parte}>
      <h3 className={estilos.tituloDaParte}>Famílias</h3>
      <ul className={estilos.familias}>
        {resumirPorFamilia(itens).map(({ familia, pecas, valor }) => (
          <li key={familia} className={estilos.familia}>
            <span className={estilos.nomeDaFamilia}>{familia}</span>
            <span className={estilos.numerosDaFamilia}>
              {formatarNumero(pecas)} peças · <Valor valor={valor} comCentavos />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Os itens do ERP, iguais no pedido em aberto, na nota e no pedido da ficha; a entrega, só com `entregaAte`. */
function ItensDoErp<T extends ItemDoErp & { entrega?: string | null }>({ descricao, itens, entregaAte }: { descricao: string; itens: readonly T[]; entregaAte?: string }) {
  const colunas: readonly [ColunaDaTabela<T>, ...ColunaDaTabela<T>[]] = entregaAte
    ? [PRODUTO, colunaDaEntrega(entregaAte), PECAS, CENTO, VALOR]
    : [PRODUTO, PECAS, CENTO, VALOR];
  return (
    <TabelaResponsiva
      descricao={descricao}
      itens={itens}
      chaveDe={(item) => String(item.ordem)}
      vazio="Sem itens."
      colunas={colunas}
      parametroDaOrdem={ORDEM_DOS_ITENS}
    />
  );
}

/** O pedido de origem à esquerda, quando há, e o caminho à direita. */
function Rodape({ children }: { children: ReactNode }) {
  return <div className={estilos.rodape}>{children}</div>;
}

function LinkParaFicha({ cliente }: { cliente: ClienteResumo }) {
  return <LinkDoRodape para={`/clientes/${cliente.codigo}`}>Abrir a ficha do cliente</LinkDoRodape>;
}

function LinkDoRodape({ para, children }: { para: string; children: ReactNode }) {
  return (
    <Link to={para} className={estilos.caminho}>
      {children}
      <ChevronRight size={15} aria-hidden="true" />
    </Link>
  );
}

/* As colunas dos itens do ERP. */

const PRODUTO: ColunaDaTabela<ItemDoErp> = {
  titulo: "Produto",
  ordenarPor: (item) => item.codigo,
  celula: (item) => <Identificacao titulo={item.codigo} detalhe={item.familia} />,
};

const PECAS: ColunaDaTabela<ItemDoErp> = {
  titulo: "Peças",
  numerica: true,
  largura: 5,
  ordenarPor: (item) => item.pecas,
  celula: (item) => formatarNumero(item.pecas),
};

/** O preço que o item pagou, com os descontos: o valor dividido pelos centos. */
const CENTO: ColunaDaTabela<ItemDoErp> = {
  titulo: "Cento",
  numerica: true,
  largura: 5.5,
  ordenarPor: precoDoCento,
  celula: (item) => <Valor valor={precoDoCento(item)} comCentavos />,
};

const VALOR: ColunaDaTabela<ItemDoErp> = {
  titulo: "Valor",
  numerica: true,
  ordenarPor: (item) => item.valor,
  celula: (item) => <Valor valor={item.valor} comCentavos />,
};

function colunaDaEntrega(hoje: string): ColunaDaTabela<{ entrega?: string | null }> {
  return { titulo: "Entrega", ordenarPor: (item) => item.entrega ?? null, celula: (item) => <DataRelativa data={item.entrega ?? null} hoje={hoje} /> };
}
