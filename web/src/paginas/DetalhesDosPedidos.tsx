import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { AndamentoDoPedido, ItensDoPedidoEnviado } from "../componentes/PedidoEnviado";
import { DataRelativa } from "../componentes/Quando";
import { Identificacao, TabelaResponsiva, type ColunaDaTabela } from "../componentes/TabelaResponsiva";
import { Valor } from "../componentes/Valor";
import { precoDoCento } from "../dados/pedido";
import type { ClienteResumo, ItemDoErp, ItemEmAberto, NotaFaturada, PedidoEnviado, PedidoNoErp } from "../dados/tipos";
import { formatarNumero, formatarPedidosDaNota } from "../formato";
import estilos from "./DetalhesDosPedidos.module.css";

/*
 * O que a linha de cada aba de Pedidos mostra ao abrir, na própria lista. O caminho para a ficha
 * do cliente, que antes era a linha inteira, fica no fim dos detalhes.
 */

/** O andamento e os itens, como na página do pedido. */
export function DetalheDoEnviado({ pedido, relogio }: { pedido: PedidoEnviado; relogio: string }) {
  return (
    <>
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
      <Rodape cliente={pedido.cliente} />
    </>
  );
}

/** Os itens que ainda faltam faturar: peças, entrega e valor do saldo de cada um. */
export function DetalheDoPedidoNoErp({ pedido, hoje }: { pedido: PedidoNoErp; hoje: string }) {
  return (
    <>
      <TabelaResponsiva
        descricao={`Itens em aberto do pedido ${pedido.numero}`}
        itens={pedido.itensEmAberto}
        chaveDe={(item) => String(item.ordem)}
        vazio="Nenhum item em aberto."
        colunas={[PRODUTO, colunaDaEntrega(hoje), PECAS, CENTO, VALOR]}
      />
      <Rodape cliente={pedido.cliente} />
    </>
  );
}

/** Os itens faturados e o pedido de onde a nota saiu. */
export function DetalheDaNota({ nota }: { nota: NotaFaturada }) {
  return (
    <>
      <TabelaResponsiva
        descricao={`Itens da nota ${nota.numero}`}
        itens={nota.itens}
        chaveDe={(item) => String(item.ordem)}
        vazio="Nota sem itens."
        colunas={[PRODUTO, PECAS, CENTO, VALOR]}
      />
      <Rodape cliente={nota.cliente} pedidos={nota.pedidos} />
    </>
  );
}

function Rodape({ cliente, pedidos = [] }: { cliente: ClienteResumo; pedidos?: string[] }) {
  return (
    <div className={estilos.rodape}>
      {pedidos.length > 0 ? <span className={estilos.origem}>{formatarPedidosDaNota(pedidos)}</span> : null}
      <Link to={`/clientes/${cliente.codigo}`} className={estilos.ficha}>
        Abrir a ficha do cliente
        <ChevronRight size={15} aria-hidden="true" />
      </Link>
    </div>
  );
}

/* As colunas dos itens do ERP, iguais no pedido em aberto e na nota. */

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

function colunaDaEntrega(hoje: string): ColunaDaTabela<ItemEmAberto> {
  return { titulo: "Entrega", ordenarPor: (item) => item.entrega, celula: (item) => <DataRelativa data={item.entrega} hoje={hoje} /> };
}
