import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { AndamentoDoPedido, ItensDoPedidoEnviado } from "../componentes/PedidoEnviado";
import { DataRelativa } from "../componentes/Quando";
import { Identificacao, ORDEM_DOS_ITENS, TabelaResponsiva, type ColunaDaTabela } from "../componentes/TabelaResponsiva";
import { Valor } from "../componentes/Valor";
import { precoDoCento, resumirPorFamilia, valorDaLinha, type TotalDaFamilia } from "../dados/pedido";
import type { ClienteResumo, ItemDoErp, NotaFaturada, PedidoDaFicha, PedidoEnviado, PedidoNoErp } from "../dados/tipos";
import { formatarNumero, formatarPedidosDaNota } from "../formato";
import estilos from "./DetalhesDosPedidos.module.css";

/*
 * O que a linha de um pedido mostra ao abrir, na própria lista: nas abas de Pedidos e na ficha do
 * cliente. Primeiro o resumo por família, depois os itens. Nas abas, o caminho para a ficha do
 * cliente, que antes era a linha inteira, fica no fim.
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

/** Os itens que ainda faltam faturar: peças, entrega e valor do saldo de cada um. */
export function DetalheDoPedidoNoErp({ pedido, hoje }: { pedido: PedidoNoErp; hoje: string }) {
  return (
    <>
      <ResumoPorFamilia itens={pedido.itensEmAberto} />
      <ItensDoErp descricao={`Itens em aberto do pedido ${pedido.numero}`} itens={pedido.itensEmAberto} entregaAte={hoje} />
      <Rodape>
        <LinkParaFicha cliente={pedido.cliente} />
      </Rodape>
    </>
  );
}

/** Os itens faturados e o pedido de onde a nota saiu. */
export function DetalheDaNota({ nota }: { nota: NotaFaturada }) {
  return (
    <>
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
 * Na ficha do cliente: o resumo e os itens; a entrega de cada item, no pedido em aberto. O rascunho
 * leva à montagem, para continuar, e o enviado, à página dele, com o andamento.
 */
export function DetalheDoPedidoDaFicha({ pedido, hoje }: { pedido: PedidoDaFicha; hoje: string }) {
  const caminho = CAMINHO_NO_CRM[pedido.status]?.(pedido.id);
  return (
    <>
      <ResumoPorFamilia itens={pedido.itens} />
      <ItensDoErp
        descricao={`Itens do pedido ${pedido.numero ?? "em rascunho"}`}
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
  rascunho: (id) => ({ para: `/pedidos/rascunhos/${id}`, texto: "Continuar o rascunho" }),
  enviado: (id) => ({ para: `/pedidos/${id}`, texto: "Ver o andamento" }),
};

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
              {formatarNumero(pecas)} peças · <Valor valor={valor} />
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
  celula: (item) => <Valor valor={precoDoCento(item)} />,
};

const VALOR: ColunaDaTabela<ItemDoErp> = {
  titulo: "Valor",
  numerica: true,
  ordenarPor: (item) => item.valor,
  celula: (item) => <Valor valor={item.valor} />,
};

function colunaDaEntrega(hoje: string): ColunaDaTabela<{ entrega?: string | null }> {
  return { titulo: "Entrega", ordenarPor: (item) => item.entrega ?? null, celula: (item) => <DataRelativa data={item.entrega ?? null} hoje={hoje} /> };
}
